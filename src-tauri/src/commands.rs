use std::sync::Arc;

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
pub fn list_tasks(db: State<'_, Arc<AppDb>>) -> Result<Vec<Task>, String> {
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
pub fn create_task(db: State<'_, Arc<AppDb>>, input: CreateTaskInput) -> Result<Task, String> {
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
pub fn delete_task(db: State<'_, Arc<AppDb>>, task_id: String) -> Result<(), String> {
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
    db: State<'_, Arc<AppDb>>,
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

// --- Inventory & Garden ---

#[derive(Debug, Serialize, Clone)]
pub struct InventoryItem {
    pub id: i64,
    pub item_type: String,
    pub item_variant: Option<String>,
    pub obtained_at: String,
    pub placed: bool,
}

#[derive(Debug, Serialize, Clone)]
pub struct PlacedObject {
    pub id: i64,
    pub inventory_id: i64,
    pub item_type: String,
    pub grid_x: f64,
    pub grid_z: f64,
    pub growth_stage: f64,
    pub random_seed: f64,
}

#[tauri::command]
pub fn get_inventory(db: State<'_, Arc<AppDb>>) -> Result<Vec<InventoryItem>, String> {
    let conn = db.conn.lock().unwrap();
    let mut stmt = conn
        .prepare("SELECT id, item_type, item_variant, obtained_at, placed FROM inventory ORDER BY obtained_at DESC")
        .map_err(|e| e.to_string())?;

    let items = stmt
        .query_map([], |row| {
            Ok(InventoryItem {
                id: row.get(0)?,
                item_type: row.get(1)?,
                item_variant: row.get(2)?,
                obtained_at: row.get(3)?,
                placed: row.get::<_, i64>(4)? != 0,
            })
        })
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();

    Ok(items)
}

#[tauri::command]
pub fn place_item(
    db: State<'_, Arc<AppDb>>,
    inventory_id: i64,
    grid_x: f64,
    grid_z: f64,
) -> Result<PlacedObject, String> {
    let conn = db.conn.lock().unwrap();
    let now = chrono::Local::now()
        .format("%Y-%m-%dT%H:%M:%S")
        .to_string();
    let random_seed: f64 = {
        use std::time::{SystemTime, UNIX_EPOCH};
        let nanos = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .subsec_nanos();
        (nanos as f64) / 1_000_000_000.0
    };

    conn.execute(
        "INSERT INTO garden_objects (inventory_id, grid_x, grid_z, placed_at, random_seed) VALUES (?1, ?2, ?3, ?4, ?5)",
        rusqlite::params![inventory_id, grid_x, grid_z, &now, random_seed],
    )
    .map_err(|e| e.to_string())?;

    conn.execute(
        "UPDATE inventory SET placed = 1 WHERE id = ?1",
        [inventory_id],
    )
    .map_err(|e| e.to_string())?;

    let obj_id = conn.last_insert_rowid();
    let item_type: String = conn
        .query_row(
            "SELECT item_type FROM inventory WHERE id = ?1",
            [inventory_id],
            |r| r.get(0),
        )
        .map_err(|e| e.to_string())?;

    Ok(PlacedObject {
        id: obj_id,
        inventory_id,
        item_type,
        grid_x,
        grid_z,
        growth_stage: 0.0,
        random_seed,
    })
}

#[tauri::command]
pub fn tick_growth(db: State<'_, Arc<AppDb>>) -> Result<f64, String> {
    let conn = db.conn.lock().unwrap();
    let now = chrono::Local::now()
        .format("%Y-%m-%dT%H:%M:%S")
        .to_string();

    let last_opened: String = conn
        .query_row(
            "SELECT last_opened FROM garden_state WHERE id = 1",
            [],
            |r| r.get(0),
        )
        .map_err(|e| e.to_string())?;

    let last_dt = chrono::NaiveDateTime::parse_from_str(&last_opened, "%Y-%m-%dT%H:%M:%S")
        .unwrap_or_else(|_| chrono::Local::now().naive_local());
    let now_dt = chrono::Local::now().naive_local();
    let elapsed_hours = (now_dt - last_dt).num_seconds() as f64 / 3600.0;

    if elapsed_hours > 0.001 {
        let growth_per_hour = 0.04;
        let delta = elapsed_hours * growth_per_hour;

        conn.execute(
            "UPDATE garden_objects SET growth_stage = growth_stage + ?1",
            rusqlite::params![delta],
        )
        .map_err(|e| e.to_string())?;
    }

    conn.execute(
        "UPDATE garden_state SET last_opened = ?1 WHERE id = 1",
        [&now],
    )
    .map_err(|e| e.to_string())?;

    Ok(elapsed_hours)
}

#[tauri::command]
pub fn get_garden_objects(db: State<'_, Arc<AppDb>>) -> Result<Vec<PlacedObject>, String> {
    let conn = db.conn.lock().unwrap();
    let mut stmt = conn
        .prepare(
            "SELECT g.id, g.inventory_id, i.item_type, g.grid_x, g.grid_z, g.growth_stage, g.random_seed
             FROM garden_objects g
             JOIN inventory i ON g.inventory_id = i.id
             ORDER BY g.placed_at ASC",
        )
        .map_err(|e| e.to_string())?;

    let objects = stmt
        .query_map([], |row| {
            Ok(PlacedObject {
                id: row.get(0)?,
                inventory_id: row.get(1)?,
                item_type: row.get(2)?,
                grid_x: row.get(3)?,
                grid_z: row.get(4)?,
                growth_stage: row.get(5)?,
                random_seed: row.get(6)?,
            })
        })
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();

    Ok(objects)
}
