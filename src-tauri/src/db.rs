use tauri_plugin_sql::{Migration, MigrationKind};

pub fn get_migrations() -> Vec<Migration> {
    vec![Migration {
        version: 1,
        description: "create initial tables",
        sql: "
            CREATE TABLE IF NOT EXISTS tasks (
                id TEXT PRIMARY KEY,
                title TEXT NOT NULL,
                created_at TEXT NOT NULL DEFAULT (datetime('now')),
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
                detected_at TEXT NOT NULL DEFAULT (datetime('now')),
                duration_secs INTEGER,
                UNIQUE(task_id, achieved_date)
            );

            CREATE TABLE IF NOT EXISTS inventory (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                item_type TEXT NOT NULL,
                item_variant TEXT,
                obtained_at TEXT NOT NULL DEFAULT (datetime('now')),
                placed INTEGER NOT NULL DEFAULT 0
            );

            CREATE TABLE IF NOT EXISTS garden_objects (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                inventory_id INTEGER NOT NULL REFERENCES inventory(id),
                grid_x REAL NOT NULL,
                grid_z REAL NOT NULL,
                growth_stage REAL NOT NULL DEFAULT 0.0,
                placed_at TEXT NOT NULL DEFAULT (datetime('now')),
                random_seed REAL NOT NULL
            );

            CREATE TABLE IF NOT EXISTS garden_state (
                id INTEGER PRIMARY KEY CHECK (id = 1),
                season_start TEXT NOT NULL DEFAULT (datetime('now')),
                last_opened TEXT NOT NULL DEFAULT (datetime('now')),
                season_number INTEGER NOT NULL DEFAULT 1
            );

            INSERT OR IGNORE INTO garden_state (id) VALUES (1);

            CREATE TABLE IF NOT EXISTS frozen_gardens (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                season_number INTEGER NOT NULL,
                frozen_at TEXT NOT NULL DEFAULT (datetime('now')),
                snapshot_json TEXT NOT NULL
            );
        ",
        kind: MigrationKind::Up,
    }]
}
