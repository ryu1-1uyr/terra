use serde::Serialize;
use std::collections::{HashMap, HashSet};
use std::sync::{Arc, Mutex};
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

struct TrackedTask {
    task_title: String,
    process_name: String,
    started_at: std::time::Instant,
    started_date: String,
    is_daily: bool,
}

pub struct TrackingState {
    inner: Mutex<HashMap<String, TrackedTask>>,
}

impl TrackingState {
    pub fn new() -> Self {
        Self {
            inner: Mutex::new(HashMap::new()),
        }
    }

    pub fn tracked_task_ids(&self) -> HashSet<String> {
        self.inner.lock().unwrap().keys().cloned().collect()
    }
}

fn random_reward_type() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};
    let nanos = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .subsec_nanos();
    let types = [
        "house", "tree", "flower", "tower", "windmill",
        "shrine", "lamp", "pond", "statue",
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

fn record_achievement(
    conn: &rusqlite::Connection,
    task_id: &str,
    achieved_date: &str,
    duration_secs: i64,
    is_daily: bool,
) -> Option<AchievementEvent> {
    let already = conn
        .query_row(
            "SELECT COUNT(*) FROM achievements WHERE task_id = ?1 AND achieved_date = ?2",
            rusqlite::params![task_id, achieved_date],
            |r| r.get::<_, i64>(0),
        )
        .unwrap_or(0);

    if already > 0 {
        return None;
    }

    let now = chrono::Local::now()
        .format("%Y-%m-%dT%H:%M:%S")
        .to_string();

    let _ = conn.execute(
        "INSERT INTO achievements (task_id, achieved_date, detected_at, duration_secs) VALUES (?1, ?2, ?3, ?4)",
        rusqlite::params![task_id, achieved_date, &now, duration_secs],
    );

    let item_type = random_reward_type();
    let _ = conn.execute(
        "INSERT INTO inventory (item_type, item_variant, obtained_at) VALUES (?1, ?2, ?3)",
        rusqlite::params![&item_type, Option::<String>::None, &now],
    );

    if !is_daily {
        let _ = conn.execute(
            "UPDATE tasks SET archived = 1 WHERE id = ?1",
            rusqlite::params![task_id],
        );
    }

    let task_title: String = conn
        .query_row(
            "SELECT title FROM tasks WHERE id = ?1",
            rusqlite::params![task_id],
            |r| r.get(0),
        )
        .unwrap_or_default();

    Some(AchievementEvent {
        task_id: task_id.to_string(),
        task_title,
        achieved_date: achieved_date.to_string(),
        reward_type: item_type,
    })
}

struct PollResult {
    achievements: Vec<AchievementEvent>,
    tracking_changed: bool,
}

fn poll_and_record(
    db: &AppDb,
    state: &TrackingState,
) -> PollResult {
    let tracking = &mut *state.inner.lock().unwrap();
    let prev_ids: HashSet<String> = tracking.keys().cloned().collect();
    let mut sys = System::new();
    sys.refresh_processes(sysinfo::ProcessesToUpdate::All, true);

    let running: std::collections::HashSet<String> = sys
        .processes()
        .values()
        .map(|p| p.name().to_string_lossy().to_lowercase())
        .collect();

    let conn = db.conn.lock().unwrap();
    let today = chrono::Local::now().format("%Y-%m-%d").to_string();

    let mut stmt = conn
        .prepare(
            "SELECT t.id, t.title, tp.process_name, t.daily
             FROM tasks t
             JOIN task_processes tp ON t.id = tp.task_id
             WHERE t.archived = 0",
        )
        .unwrap();

    let rows: Vec<(String, String, String, bool)> = stmt
        .query_map([], |row| {
            Ok((
                row.get::<_, String>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, String>(2)?,
                row.get::<_, bool>(3)?,
            ))
        })
        .unwrap()
        .filter_map(|r| r.ok())
        .collect();

    let mut events = Vec::new();

    // Phase 1: date rollover — if tracking started yesterday, finalize and restart
    let mut rollovers: Vec<String> = Vec::new();
    for (task_id, tracked) in tracking.iter() {
        if tracked.started_date != today {
            rollovers.push(task_id.clone());
        }
    }
    for task_id in rollovers {
        if let Some(tracked) = tracking.remove(&task_id) {
            let duration_secs = tracked.started_at.elapsed().as_secs() as i64;
            if let Some(ev) = record_achievement(
                &conn,
                &task_id,
                &tracked.started_date,
                duration_secs,
                tracked.is_daily,
            ) {
                events.push(ev);
            }
            // Restart tracking for today if process is still running
            if running.contains(&tracked.process_name.to_lowercase()) {
                tracking.insert(
                    task_id,
                    TrackedTask {
                        task_title: tracked.task_title,
                        process_name: tracked.process_name,
                        started_at: std::time::Instant::now(),
                        started_date: today.clone(),
                        is_daily: tracked.is_daily,
                    },
                );
            }
        }
    }

    // Phase 2: start tracking newly detected processes
    for (task_id, task_title, process_name, is_daily) in &rows {
        if tracking.contains_key(task_id) {
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
                tracking.insert(
                    task_id.clone(),
                    TrackedTask {
                        task_title: task_title.clone(),
                        process_name: process_name.clone(),
                        started_at: std::time::Instant::now(),
                        started_date: today.clone(),
                        is_daily: *is_daily,
                    },
                );
            }
        }
    }

    // Phase 3: process stopped — record achievement
    let mut completed: Vec<String> = Vec::new();
    for (task_id, tracked) in tracking.iter() {
        if !running.contains(&tracked.process_name.to_lowercase()) {
            let duration_secs = tracked.started_at.elapsed().as_secs() as i64;
            if let Some(ev) = record_achievement(
                &conn,
                &task_id,
                &tracked.started_date,
                duration_secs,
                tracked.is_daily,
            ) {
                events.push(ev);
            }
            completed.push(task_id.clone());
        }
    }

    for id in completed {
        tracking.remove(&id);
    }

    let current_ids: HashSet<String> = tracking.keys().cloned().collect();
    let tracking_changed = prev_ids != current_ids;

    PollResult {
        achievements: events,
        tracking_changed,
    }
}

pub fn start_polling(app_handle: tauri::AppHandle, db: Arc<AppDb>, state: Arc<TrackingState>) {
    tauri::async_runtime::spawn(async move {
        let mut interval = tokio::time::interval(std::time::Duration::from_secs(30));
        loop {
            interval.tick().await;
            let result = poll_and_record(&db, &state);
            for event in result.achievements {
                let _ = app_handle.emit("achievement", &event);
            }
            if result.tracking_changed {
                let _ = app_handle.emit("tracking-changed", ());
            }
        }
    });
}
