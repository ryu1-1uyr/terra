use rusqlite::Connection;
use std::path::PathBuf;
use std::sync::Mutex;

pub struct AppDb {
    pub conn: Mutex<Connection>,
}

impl AppDb {
    pub fn new(app_dir: PathBuf) -> Result<Self, String> {
        std::fs::create_dir_all(&app_dir).map_err(|e| e.to_string())?;
        let db_path = app_dir.join("terra.db");
        let conn = Connection::open(&db_path).map_err(|e| e.to_string())?;
        conn.execute_batch("PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;")
            .map_err(|e| e.to_string())?;
        let db = Self {
            conn: Mutex::new(conn),
        };
        db.run_migrations()?;
        Ok(db)
    }

    fn run_migrations(&self) -> Result<(), String> {
        let conn = self.conn.lock().unwrap();
        conn.execute_batch(
            "
            CREATE TABLE IF NOT EXISTS tasks (
                id TEXT PRIMARY KEY,
                title TEXT NOT NULL,
                created_at TEXT NOT NULL,
                archived INTEGER NOT NULL DEFAULT 0
            );

            CREATE TABLE IF NOT EXISTS task_processes (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
                process_name TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS achievements (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
                achieved_date TEXT NOT NULL,
                detected_at TEXT NOT NULL,
                duration_secs INTEGER,
                UNIQUE(task_id, achieved_date)
            );

            CREATE TABLE IF NOT EXISTS inventory (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                item_type TEXT NOT NULL,
                item_variant TEXT,
                obtained_at TEXT NOT NULL,
                placed INTEGER NOT NULL DEFAULT 0
            );

            CREATE TABLE IF NOT EXISTS garden_objects (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                inventory_id INTEGER NOT NULL REFERENCES inventory(id),
                grid_x REAL NOT NULL,
                grid_z REAL NOT NULL,
                growth_stage REAL NOT NULL DEFAULT 0.0,
                placed_at TEXT NOT NULL,
                random_seed REAL NOT NULL
            );

            CREATE TABLE IF NOT EXISTS garden_state (
                id INTEGER PRIMARY KEY CHECK (id = 1),
                season_start TEXT NOT NULL,
                last_opened TEXT NOT NULL,
                season_number INTEGER NOT NULL DEFAULT 1
            );

            CREATE TABLE IF NOT EXISTS frozen_gardens (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                season_number INTEGER NOT NULL,
                frozen_at TEXT NOT NULL,
                snapshot_json TEXT NOT NULL
            );
            ",
        )
        .map_err(|e| e.to_string())?;

        let now = chrono::Local::now().format("%Y-%m-%dT%H:%M:%S").to_string();
        conn.execute(
            "INSERT OR IGNORE INTO garden_state (id, season_start, last_opened, season_number) VALUES (1, ?1, ?1, 1)",
            [&now],
        )
        .map_err(|e| e.to_string())?;

        // Migration: add daily column to tasks
        let has_daily: bool = conn
            .prepare("SELECT COUNT(*) FROM pragma_table_info('tasks') WHERE name='daily'")
            .and_then(|mut s| s.query_row([], |r| r.get::<_, i64>(0)))
            .unwrap_or(0)
            > 0;
        if !has_daily {
            conn.execute_batch("ALTER TABLE tasks ADD COLUMN daily INTEGER NOT NULL DEFAULT 0;")
                .map_err(|e| e.to_string())?;
        }

        let has_last_bonus: bool = conn
            .prepare("SELECT COUNT(*) FROM pragma_table_info('garden_state') WHERE name='last_bonus_date'")
            .and_then(|mut s| s.query_row([], |r| r.get::<_, i64>(0)))
            .unwrap_or(0)
            > 0;
        if !has_last_bonus {
            conn.execute_batch("ALTER TABLE garden_state ADD COLUMN last_bonus_date TEXT;")
                .map_err(|e| e.to_string())?;
        }

        let has_frozen_grid_size: bool = conn
            .prepare("SELECT COUNT(*) FROM pragma_table_info('frozen_gardens') WHERE name='grid_size'")
            .and_then(|mut s| s.query_row([], |r| r.get::<_, i64>(0)))
            .unwrap_or(0)
            > 0;
        if !has_frozen_grid_size {
            conn.execute_batch("ALTER TABLE frozen_gardens ADD COLUMN grid_size INTEGER NOT NULL DEFAULT 8;")
                .map_err(|e| e.to_string())?;
        }

        let has_grid_size: bool = conn
            .prepare("SELECT COUNT(*) FROM pragma_table_info('garden_state') WHERE name='grid_size'")
            .and_then(|mut s| s.query_row([], |r| r.get::<_, i64>(0)))
            .unwrap_or(0)
            > 0;
        if !has_grid_size {
            conn.execute_batch("ALTER TABLE garden_state ADD COLUMN grid_size INTEGER NOT NULL DEFAULT 8;")
                .map_err(|e| e.to_string())?;
        }

        Ok(())
    }
}
