use serde::{Deserialize, Serialize};
use tauri::State;

use crate::db::AppDb;
use crate::process_monitor;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Task {
    pub id: String,
    pub title: String,
    pub created_at: String,
    pub processes: Vec<String>,
    pub achieved_today: bool,
    pub total_achievements: i64,
}

#[derive(Debug, Deserialize)]
pub struct CreateTaskInput {
    pub title: String,
    pub processes: Vec<String>,
}

#[tauri::command]
pub fn list_tasks(db: State<'_, AppDb>) -> Result<Vec<Task>, String> {
    let conn = db.conn.lock().unwrap();
    let today = chrono::Local::now().format("%Y-%m-%d").to_string();

    let mut stmt = conn
        .prepare("SELECT id, title, created_at FROM tasks WHERE archived = 0 ORDER BY created_at DESC")
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map([], |row| {
            Ok((
                row.get::<_, String>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, String>(2)?,
            ))
        })
        .map_err(|e| e.to_string())?;

    let mut tasks = Vec::new();
    for row in rows {
        let (id, title, created_at) = row.map_err(|e| e.to_string())?;

        let processes: Vec<String> = {
            let mut ps = conn
                .prepare("SELECT process_name FROM task_processes WHERE task_id = ?1")
                .map_err(|e| e.to_string())?;
            let result: Vec<String> = ps
                .query_map([&id], |r| r.get(0))
                .map_err(|e| e.to_string())?
                .filter_map(|r| r.ok())
                .collect();
            result
        };

        let achieved_today: bool = conn
            .query_row(
                "SELECT COUNT(*) FROM achievements WHERE task_id = ?1 AND achieved_date = ?2",
                [&id, &today],
                |r| r.get::<_, i64>(0),
            )
            .map(|c| c > 0)
            .unwrap_or(false);

        let total_achievements: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM achievements WHERE task_id = ?1",
                [&id],
                |r| r.get(0),
            )
            .unwrap_or(0);

        tasks.push(Task {
            id,
            title,
            created_at,
            processes,
            achieved_today,
            total_achievements,
        });
    }

    Ok(tasks)
}

#[tauri::command]
pub fn create_task(db: State<'_, AppDb>, input: CreateTaskInput) -> Result<Task, String> {
    let conn = db.conn.lock().unwrap();
    let id = uuid::Uuid::new_v4().to_string();
    let now = chrono::Local::now()
        .format("%Y-%m-%dT%H:%M:%S")
        .to_string();

    conn.execute(
        "INSERT INTO tasks (id, title, created_at) VALUES (?1, ?2, ?3)",
        rusqlite::params![&id, &input.title, &now],
    )
    .map_err(|e| e.to_string())?;

    for process in &input.processes {
        conn.execute(
            "INSERT INTO task_processes (task_id, process_name) VALUES (?1, ?2)",
            rusqlite::params![&id, process],
        )
        .map_err(|e| e.to_string())?;
    }

    Ok(Task {
        id,
        title: input.title,
        created_at: now,
        processes: input.processes,
        achieved_today: false,
        total_achievements: 0,
    })
}

#[tauri::command]
pub fn delete_task(db: State<'_, AppDb>, task_id: String) -> Result<(), String> {
    let conn = db.conn.lock().unwrap();
    conn.execute(
        "DELETE FROM task_processes WHERE task_id = ?1",
        [&task_id],
    )
    .map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM achievements WHERE task_id = ?1", [&task_id])
        .map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM tasks WHERE id = ?1", [&task_id])
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn update_task_processes(
    db: State<'_, AppDb>,
    task_id: String,
    processes: Vec<String>,
) -> Result<(), String> {
    let conn = db.conn.lock().unwrap();
    conn.execute(
        "DELETE FROM task_processes WHERE task_id = ?1",
        [&task_id],
    )
    .map_err(|e| e.to_string())?;

    for process in &processes {
        conn.execute(
            "INSERT INTO task_processes (task_id, process_name) VALUES (?1, ?2)",
            rusqlite::params![&task_id, process],
        )
        .map_err(|e| e.to_string())?;
    }

    Ok(())
}

#[tauri::command]
pub fn get_running_processes() -> Vec<process_monitor::RunningProcess> {
    process_monitor::list_running_processes()
}
