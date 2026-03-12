use base64::{engine::general_purpose, Engine};
use tauri::Manager;
use tauri_plugin_sql::{Migration, MigrationKind};
use uuid::Uuid;

fn poster_cache_dir(app: &tauri::AppHandle) -> Result<std::path::PathBuf, String> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?
        .join("poster-cache");
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir)
}

fn tmdb_poster_filename(tmdb_id: i64) -> String {
    format!("{}_w185.jpg", tmdb_id)
}

fn file_to_data_url(path: &std::path::Path) -> Result<String, String> {
    let bytes = std::fs::read(path).map_err(|e| e.to_string())?;
    let b64 = general_purpose::STANDARD.encode(&bytes);
    Ok(format!("data:image/jpeg;base64,{}", b64))
}

#[tauri::command]
async fn cache_poster(
    app: tauri::AppHandle,
    tmdb_id: i64,
    url: String,
) -> Result<String, String> {
    let cache_dir = poster_cache_dir(&app)?;
    let path = cache_dir.join(tmdb_poster_filename(tmdb_id));

    // Return cached version immediately if it exists
    if path.exists() {
        return file_to_data_url(&path);
    }

    let bytes = reqwest::get(&url)
        .await
        .map_err(|e| e.to_string())?
        .error_for_status()
        .map_err(|e| e.to_string())?
        .bytes()
        .await
        .map_err(|e| e.to_string())?;

    std::fs::write(&path, &bytes).map_err(|e| e.to_string())?;

    let b64 = general_purpose::STANDARD.encode(&bytes);
    Ok(format!("data:image/jpeg;base64,{}", b64))
}

#[tauri::command]
fn get_cached_poster(app: tauri::AppHandle, tmdb_id: i64) -> Result<Option<String>, String> {
    let cache_dir = poster_cache_dir(&app)?;
    let path = cache_dir.join(tmdb_poster_filename(tmdb_id));
    if path.exists() {
        Ok(Some(file_to_data_url(&path)?))
    } else {
        Ok(None)
    }
}

#[tauri::command]
fn clear_poster_cache(app: tauri::AppHandle) -> Result<(), String> {
    let cache_dir = poster_cache_dir(&app)?;
    for entry in std::fs::read_dir(&cache_dir).map_err(|e| e.to_string())? {
        let entry = entry.map_err(|e| e.to_string())?;
        std::fs::remove_file(entry.path()).map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
fn get_poster_cache_size(app: tauri::AppHandle) -> Result<i64, String> {
    let cache_dir = poster_cache_dir(&app)?;
    let total = std::fs::read_dir(&cache_dir)
        .map_err(|e| e.to_string())?
        .filter_map(|e| e.ok())
        .filter_map(|e| e.metadata().ok())
        .map(|m| m.len())
        .sum::<u64>();
    Ok(total as i64)
}

/// Resize a picked image (already encoded as JPEG on the JS side) and
/// persist it to the poster-cache directory.  The JS side does the canvas
/// resize so all we receive here is the final JPEG bytes as base64.
#[tauri::command]
fn save_custom_poster(app: tauri::AppHandle, base64_data: String) -> Result<String, String> {
    let bytes = general_purpose::STANDARD
        .decode(&base64_data)
        .map_err(|e| e.to_string())?;

    let cache_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?
        .join("poster-cache");

    std::fs::create_dir_all(&cache_dir).map_err(|e| e.to_string())?;

    let filename = format!("custom_{}_w185.jpg", Uuid::new_v4());
    let path = cache_dir.join(&filename);

    std::fs::write(&path, bytes).map_err(|e| e.to_string())?;

    Ok(path.to_string_lossy().to_string())
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
        Migration {
            version: 2,
            description: "personal_rating_real",
            sql: "
                CREATE TABLE movies_new (
                    id              TEXT PRIMARY KEY,
                    tmdb_id         INTEGER,
                    title           TEXT NOT NULL,
                    year            INTEGER,
                    poster_url      TEXT,
                    tmdb_rating     REAL,
                    personal_rating REAL,
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

                INSERT INTO movies_new SELECT * FROM movies;

                DROP TABLE movies;

                ALTER TABLE movies_new RENAME TO movies;

                CREATE INDEX idx_movies_tmdb_id ON movies (tmdb_id);

                CREATE TRIGGER movies_updated_at
                AFTER UPDATE ON movies
                FOR EACH ROW
                BEGIN
                    UPDATE movies SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
                    WHERE id = OLD.id;
                END;
            ",
            kind: MigrationKind::Up,
        },
        Migration {
            version: 3,
            description: "add_type_show_id_season_number",
            sql: "
                ALTER TABLE movies ADD COLUMN type TEXT NOT NULL DEFAULT 'MOVIE';
                ALTER TABLE movies ADD COLUMN show_id TEXT;
                ALTER TABLE movies ADD COLUMN season_number INTEGER;
            ",
            kind: MigrationKind::Up,
        },
    ];

    tauri::Builder::default()
        .plugin(
            tauri_plugin_sql::Builder::new()
                .add_migrations("sqlite:movies.db", migrations)
                .build(),
        )
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .invoke_handler(tauri::generate_handler![
            save_custom_poster,
            cache_poster,
            get_cached_poster,
            clear_poster_cache,
            get_poster_cache_size,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
