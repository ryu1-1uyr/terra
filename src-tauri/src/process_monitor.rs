use serde::Serialize;
use std::sync::Arc;
use sysinfo::System;
use tauri::Emitter;

use crate::db::AppDb;

#[derive(Debug, Serialize, Clone)]
pub struct RunningProcess {
    pub name: String,
    pub pid: u32,
}

#[derive(Debug, Serialize, Clone)]
pub struct AchievementEvent {
    pub task_id: String,
    pub task_title: String,
    pub achieved_date: String,
    pub reward_type: String,
}

fn random_reward_type() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};
    let nanos = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .subsec_nanos();
    let types = [
        "house", "tree", "flower", "flower", "tree",
        "windmill", "shrine", "lamp", "pond", "statue",
        "tree", "flower", "house",
    ];
    types[(nanos as usize) % types.len()].to_string()
}

pub fn list_running_processes() -> Vec<RunningProcess> {
    let mut sys = System::new();
    sys.refresh_processes(sysinfo::ProcessesToUpdate::All, true);

    let mut seen = std::collections::HashSet::new();
    let mut result = Vec::new();

    for (pid, process) in sys.processes() {
        let name = process.name().to_string_lossy().to_string();
        if seen.insert(name.clone()) {
            result.push(RunningProcess {
                name,
                pid: pid.as_u32(),
            });
        }
    }

    result.sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase()));
    result
}

pub fn check_and_record_achievements(db: &AppDb) -> Vec<AchievementEvent> {
    let mut sys = System::new();
    sys.refresh_processes(sysinfo::ProcessesToUpdate::All, true);

    let running: std::collections::HashSet<String> = sys
        .processes()
        .values()
        .map(|p| p.name().to_string_lossy().to_lowercase())
        .collect();

    let conn = db.conn.lock().unwrap();
    let today = chrono::Local::now().format("%Y-%m-%d").to_string();
    let now = chrono::Local::now()
        .format("%Y-%m-%dT%H:%M:%S")
        .to_string();

    let mut stmt = conn
        .prepare(
            "SELECT t.id, t.title, tp.process_name
             FROM tasks t
             JOIN task_processes tp ON t.id = tp.task_id
             WHERE t.archived = 0",
        )
        .unwrap();

    let rows: Vec<(String, String, String)> = stmt
        .query_map([], |row| {
            Ok((
                row.get::<_, String>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, String>(2)?,
            ))
        })
        .unwrap()
        .filter_map(|r| r.ok())
        .collect();

    let mut events = Vec::new();
    let mut recorded_tasks = std::collections::HashSet::new();

    for (task_id, task_title, process_name) in &rows {
        if recorded_tasks.contains(task_id) {
            continue;
        }

        if running.contains(&process_name.to_lowercase()) {
            let already = conn
                .query_row(
                    "SELECT COUNT(*) FROM achievements WHERE task_id = ?1 AND achieved_date = ?2",
                    rusqlite::params![task_id, &today],
                    |r| r.get::<_, i64>(0),
                )
                .unwrap_or(0);

            if already == 0 {
                let _ = conn.execute(
                    "INSERT INTO achievements (task_id, achieved_date, detected_at) VALUES (?1, ?2, ?3)",
                    rusqlite::params![task_id, &today, &now],
                );

                let item_type = random_reward_type();
                let _ = conn.execute(
                    "INSERT INTO inventory (item_type, item_variant, obtained_at) VALUES (?1, ?2, ?3)",
                    rusqlite::params![&item_type, Option::<String>::None, &now],
                );

                events.push(AchievementEvent {
                    task_id: task_id.clone(),
                    task_title: task_title.clone(),
                    achieved_date: today.clone(),
                    reward_type: item_type,
                });
            }
            recorded_tasks.insert(task_id.clone());
        }
    }

    events
}

pub fn start_polling(app_handle: tauri::AppHandle, db: Arc<AppDb>) {
    tauri::async_runtime::spawn(async move {
        let mut interval = tokio::time::interval(std::time::Duration::from_secs(30));
        loop {
            interval.tick().await;
            let events = check_and_record_achievements(&db);
            for event in events {
                let _ = app_handle.emit("achievement", &event);
            }
        }
    });
}
