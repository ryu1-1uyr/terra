use std::sync::Arc;

use serde::{Deserialize, Serialize};
use tauri::State;

use crate::db::AppDb;
use crate::process_monitor::{self, TrackingState};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Task {
    pub id: String,
    pub title: String,
    pub created_at: String,
    pub processes: Vec<String>,
    pub achieved_today: bool,
    pub tracking: bool,
    pub total_achievements: i64,
    pub daily: bool,
    pub current_streak: i64,
}

#[derive(Debug, Deserialize)]
pub struct CreateTaskInput {
    pub title: String,
    pub processes: Vec<String>,
    pub daily: bool,
}

#[tauri::command]
pub fn list_tasks(
    db: State<'_, Arc<AppDb>>,
    tracking_state: State<'_, Arc<TrackingState>>,
) -> Result<Vec<Task>, String> {
    let conn = db.conn.lock().unwrap();
    let today = chrono::Local::now().format("%Y-%m-%d").to_string();
    let tracked_ids = tracking_state.tracked_task_ids();

    let mut stmt = conn
        .prepare("SELECT id, title, created_at, daily FROM tasks WHERE archived = 0 ORDER BY created_at DESC")
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map([], |row| {
            Ok((
                row.get::<_, String>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, String>(2)?,
                row.get::<_, bool>(3)?,
            ))
        })
        .map_err(|e| e.to_string())?;

    let mut tasks = Vec::new();
    for row in rows {
        let (id, title, created_at, daily) = row.map_err(|e| e.to_string())?;

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

        let current_streak: i64 = if daily {
            let mut dates_stmt = conn
                .prepare(
                    "SELECT achieved_date FROM achievements WHERE task_id = ?1 ORDER BY achieved_date DESC",
                )
                .unwrap();
            let dates: Vec<String> = dates_stmt
                .query_map([&id], |r| r.get(0))
                .unwrap()
                .filter_map(|r| r.ok())
                .collect();

            let mut streak = 0i64;
            let mut expected = chrono::Local::now().date_naive();
            for date_str in &dates {
                if let Ok(d) = chrono::NaiveDate::parse_from_str(date_str, "%Y-%m-%d") {
                    if d == expected {
                        streak += 1;
                        expected -= chrono::Duration::days(1);
                    } else if d < expected {
                        break;
                    }
                }
            }
            streak
        } else {
            0
        };

        let tracking = tracked_ids.contains(&id);

        tasks.push(Task {
            id,
            title,
            created_at,
            processes,
            achieved_today,
            tracking,
            total_achievements,
            daily,
            current_streak,
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
        "INSERT INTO tasks (id, title, created_at, daily) VALUES (?1, ?2, ?3, ?4)",
        rusqlite::params![&id, &input.title, &now, input.daily],
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
        tracking: false,
        total_achievements: 0,
        daily: input.daily,
        current_streak: 0,
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

#[derive(Debug, Deserialize)]
pub struct UpdateTaskInput {
    pub title: String,
    pub processes: Vec<String>,
}

#[tauri::command]
pub fn update_task(
    db: State<'_, Arc<AppDb>>,
    task_id: String,
    input: UpdateTaskInput,
) -> Result<(), String> {
    let conn = db.conn.lock().unwrap();

    conn.execute(
        "UPDATE tasks SET title = ?1 WHERE id = ?2",
        rusqlite::params![&input.title, &task_id],
    )
    .map_err(|e| e.to_string())?;

    conn.execute(
        "DELETE FROM task_processes WHERE task_id = ?1",
        [&task_id],
    )
    .map_err(|e| e.to_string())?;

    for process in &input.processes {
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

#[derive(Debug, Serialize, Clone)]
pub struct AchievementRecord {
    pub id: i64,
    pub task_id: String,
    pub task_title: String,
    pub achieved_date: String,
    pub detected_at: String,
    pub duration_secs: Option<i64>,
}

#[tauri::command]
pub fn get_achievements(db: State<'_, Arc<AppDb>>) -> Result<Vec<AchievementRecord>, String> {
    let conn = db.conn.lock().unwrap();
    let mut stmt = conn
        .prepare(
            "SELECT a.id, a.task_id, t.title, a.achieved_date, a.detected_at, a.duration_secs
             FROM achievements a
             JOIN tasks t ON a.task_id = t.id
             ORDER BY a.achieved_date DESC, a.detected_at DESC
             LIMIT 100",
        )
        .map_err(|e| e.to_string())?;

    let records = stmt
        .query_map([], |row| {
            Ok(AchievementRecord {
                id: row.get(0)?,
                task_id: row.get(1)?,
                task_title: row.get(2)?,
                achieved_date: row.get(3)?,
                detected_at: row.get(4)?,
                duration_secs: row.get(5)?,
            })
        })
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();

    Ok(records)
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
pub fn unplace_item(db: State<'_, Arc<AppDb>>, inventory_id: i64) -> Result<(), String> {
    let conn = db.conn.lock().unwrap();
    conn.execute(
        "DELETE FROM garden_objects WHERE inventory_id = ?1",
        [inventory_id],
    )
    .map_err(|e| e.to_string())?;
    conn.execute(
        "UPDATE inventory SET placed = 0 WHERE id = ?1",
        [inventory_id],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
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
        let base_rate = 0.04;
        // Per-object growth with variance based on random_seed (±40%)
        // Biased slightly high so average is ~1.08x base ("上振れ")
        conn.execute(
            "UPDATE garden_objects SET growth_stage = growth_stage + ?1 * (0.88 + random_seed * 0.4)",
            rusqlite::params![elapsed_hours * base_rate],
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

// --- Season & Freeze ---

#[derive(Debug, Serialize, Clone)]
pub struct SeasonInfo {
    pub season_number: i64,
    pub season_start: String,
    pub days_elapsed: i64,
    pub should_wipe: bool,
}

#[tauri::command]
pub fn get_season_info(db: State<'_, Arc<AppDb>>) -> Result<SeasonInfo, String> {
    let conn = db.conn.lock().unwrap();
    let (season_number, season_start): (i64, String) = conn
        .query_row(
            "SELECT season_number, season_start FROM garden_state WHERE id = 1",
            [],
            |r| Ok((r.get(0)?, r.get(1)?)),
        )
        .map_err(|e| e.to_string())?;

    let start_dt = chrono::NaiveDateTime::parse_from_str(&season_start, "%Y-%m-%dT%H:%M:%S")
        .unwrap_or_else(|_| chrono::Local::now().naive_local());
    let now_dt = chrono::Local::now().naive_local();
    let days_elapsed = (now_dt - start_dt).num_days();
    let should_wipe = days_elapsed >= 90;

    Ok(SeasonInfo {
        season_number,
        season_start,
        days_elapsed,
        should_wipe,
    })
}

#[derive(Debug, Serialize, Clone)]
pub struct FrozenGarden {
    pub id: i64,
    pub season_number: i64,
    pub frozen_at: String,
    pub snapshot_json: String,
}

#[tauri::command]
pub fn freeze_and_wipe(db: State<'_, Arc<AppDb>>) -> Result<i64, String> {
    let conn = db.conn.lock().unwrap();
    let now = chrono::Local::now()
        .format("%Y-%m-%dT%H:%M:%S")
        .to_string();

    let season_number: i64 = conn
        .query_row(
            "SELECT season_number FROM garden_state WHERE id = 1",
            [],
            |r| r.get(0),
        )
        .map_err(|e| e.to_string())?;

    let mut stmt = conn
        .prepare(
            "SELECT g.id, g.inventory_id, i.item_type, g.grid_x, g.grid_z, g.growth_stage, g.random_seed
             FROM garden_objects g
             JOIN inventory i ON g.inventory_id = i.id
             ORDER BY g.placed_at ASC",
        )
        .map_err(|e| e.to_string())?;

    let objects: Vec<PlacedObject> = stmt
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

    let snapshot = serde_json::to_string(&objects).map_err(|e| e.to_string())?;

    conn.execute(
        "INSERT INTO frozen_gardens (season_number, frozen_at, snapshot_json) VALUES (?1, ?2, ?3)",
        rusqlite::params![season_number, &now, &snapshot],
    )
    .map_err(|e| e.to_string())?;

    let frozen_id = conn.last_insert_rowid();

    conn.execute("DELETE FROM garden_objects", [])
        .map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM inventory", [])
        .map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM achievements", [])
        .map_err(|e| e.to_string())?;

    conn.execute(
        "UPDATE garden_state SET season_number = season_number + 1, season_start = ?1, last_opened = ?1 WHERE id = 1",
        [&now],
    )
    .map_err(|e| e.to_string())?;

    Ok(frozen_id)
}

#[tauri::command]
pub fn list_frozen_gardens(db: State<'_, Arc<AppDb>>) -> Result<Vec<FrozenGarden>, String> {
    let conn = db.conn.lock().unwrap();
    let mut stmt = conn
        .prepare("SELECT id, season_number, frozen_at, snapshot_json FROM frozen_gardens ORDER BY frozen_at DESC")
        .map_err(|e| e.to_string())?;

    let gardens = stmt
        .query_map([], |row| {
            Ok(FrozenGarden {
                id: row.get(0)?,
                season_number: row.get(1)?,
                frozen_at: row.get(2)?,
                snapshot_json: row.get(3)?,
            })
        })
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();

    Ok(gardens)
}

// --- Bonus Items ---

const ITEM_TYPES: &[&str] = &[
    "house", "tree", "flower", "tower", "windmill", "shrine", "lamp", "pond", "statue",
];

fn grant_random_items(conn: &rusqlite::Connection, count: usize) -> Result<usize, String> {
    let now = chrono::Local::now()
        .format("%Y-%m-%dT%H:%M:%S")
        .to_string();
    let mut granted = 0;
    for _ in 0..count {
        use std::time::{SystemTime, UNIX_EPOCH};
        let nanos = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .subsec_nanos() as usize;
        let item_type = ITEM_TYPES[nanos % ITEM_TYPES.len()];
        conn.execute(
            "INSERT INTO inventory (item_type, item_variant, obtained_at, placed) VALUES (?1, NULL, ?2, 0)",
            rusqlite::params![item_type, &now],
        )
        .map_err(|e| e.to_string())?;
        granted += 1;
        std::thread::sleep(std::time::Duration::from_millis(1));
    }
    Ok(granted)
}

#[tauri::command]
pub fn check_and_grant_bonus(db: State<'_, Arc<AppDb>>) -> Result<Vec<String>, String> {
    let conn = db.conn.lock().unwrap();
    let today = chrono::Local::now().format("%Y-%m-%d").to_string();

    let last_bonus: Option<String> = conn
        .query_row(
            "SELECT last_bonus_date FROM garden_state WHERE id = 1",
            [],
            |r| r.get(0),
        )
        .ok();

    if last_bonus.as_deref() == Some(today.as_str()) {
        return Ok(vec![]);
    }

    let total_items: i64 = conn
        .query_row("SELECT COUNT(*) FROM inventory", [], |r| r.get(0))
        .unwrap_or(0);

    let total_achievements: i64 = conn
        .query_row("SELECT COUNT(*) FROM achievements", [], |r| r.get(0))
        .unwrap_or(0);

    let mut bonuses = Vec::new();

    if total_items == 0 && total_achievements == 0 {
        grant_random_items(&conn, 3)?;
        bonuses.push("初回ボーナス: 3アイテム獲得！".to_string());
    }

    let streak = calc_login_streak(&conn, &today);
    if streak >= 7 && streak % 7 == 0 {
        grant_random_items(&conn, 3)?;
        bonuses.push(format!("{}日連続ログインボーナス: 3アイテム獲得！", streak));
    }

    conn.execute(
        "UPDATE garden_state SET last_bonus_date = ?1 WHERE id = 1",
        [&today],
    )
    .map_err(|e| e.to_string())?;

    Ok(bonuses)
}

fn calc_login_streak(conn: &rusqlite::Connection, today: &str) -> i64 {
    let dates: Vec<String> = {
        let mut stmt = conn
            .prepare("SELECT DISTINCT achieved_date FROM achievements ORDER BY achieved_date DESC")
            .unwrap();
        stmt.query_map([], |r| r.get(0))
            .unwrap()
            .filter_map(|r| r.ok())
            .collect()
    };

    let mut streak = 0i64;
    let mut expected = chrono::NaiveDate::parse_from_str(today, "%Y-%m-%d")
        .unwrap_or_else(|_| chrono::Local::now().date_naive());

    for date_str in &dates {
        if let Ok(d) = chrono::NaiveDate::parse_from_str(date_str, "%Y-%m-%d") {
            if d == expected {
                streak += 1;
                expected -= chrono::Duration::days(1);
            } else if d < expected {
                break;
            }
        }
    }
    streak
}
