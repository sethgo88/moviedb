// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
use tauri_plugin_sql::{Migration, MigrationKind};

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let migrations = vec![
        Migration {
            version: 1,
            description: "create_initial_tables",
            sql: "
                CREATE TABLE movies (
                    id              TEXT PRIMARY KEY,
                    tmdb_id         INTEGER,
                    title           TEXT NOT NULL,
                    year            INTEGER,
                    poster_url      TEXT,
                    tmdb_rating     REAL,
                    personal_rating INTEGER,
                    status          TEXT,
                    format          TEXT,
                    is_physical     INTEGER NOT NULL DEFAULT 0,
                    is_digital      INTEGER NOT NULL DEFAULT 0,
                    is_backed_up    INTEGER NOT NULL DEFAULT 0,
                    notes           TEXT,
                    deleted_at      TEXT,
                    created_at      TEXT NOT NULL,
                    updated_at      TEXT NOT NULL
                );

                CREATE INDEX idx_movies_tmdb_id ON movies (tmdb_id);

                CREATE TRIGGER movies_updated_at
                AFTER UPDATE ON movies
                FOR EACH ROW
                BEGIN
                    UPDATE movies SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
                    WHERE id = OLD.id;
                END;

                CREATE TABLE sync_meta (
                    last_synced_at TEXT
                );

                INSERT INTO sync_meta (last_synced_at) VALUES (NULL);
            ",
            kind: MigrationKind::Up,
        },
    ];

    tauri::Builder::default()
        .plugin(tauri_plugin_sql::Builder::new().add_migrations("sqlite:movies.db", migrations).build())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![greet])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
