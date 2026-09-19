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

/// Desktop: write directly to the OS Downloads folder.
#[cfg(not(target_os = "android"))]
#[tauri::command]
async fn write_to_downloads(
    app: tauri::AppHandle,
    filename: String,
    content: String,
) -> Result<String, String> {
    let download_dir = app.path().download_dir().map_err(|e| e.to_string())?;
    std::fs::create_dir_all(&download_dir).map_err(|e| e.to_string())?;
    let path = download_dir.join(&filename);
    std::fs::write(&path, content.as_bytes()).map_err(|e| e.to_string())?;
    Ok(path.to_string_lossy().to_string())
}

/// Android 10+: direct external-storage writes are blocked by scoped storage.
/// Use the MediaStore ContentProvider to insert into the public Downloads folder.
#[cfg(target_os = "android")]
#[tauri::command]
async fn write_to_downloads(filename: String, content: String) -> Result<String, String> {
    use jni::{
        objects::{JObject, JString, JValue},
        JavaVM,
    };

    let mime_type = if filename.ends_with(".json") {
        "application/json"
    } else if filename.ends_with(".csv") {
        "text/csv"
    } else {
        "application/octet-stream"
    };

    let ctx = ndk_context::android_context();
    let vm = unsafe { JavaVM::from_raw(ctx.vm().cast()) }.map_err(|e| e.to_string())?;
    let mut env = vm.attach_current_thread().map_err(|e| e.to_string())?;
    let activity = unsafe { JObject::from_raw(ctx.context().cast()) };

    // ContentResolver
    let resolver = env
        .call_method(
            &activity,
            "getContentResolver",
            "()Landroid/content/ContentResolver;",
            &[],
        )
        .map_err(|e| e.to_string())?
        .l()
        .map_err(|e| e.to_string())?;

    // ContentValues with display name, MIME type and target sub-folder
    let cv_class = env
        .find_class("android/content/ContentValues")
        .map_err(|e| e.to_string())?;
    let cv = env
        .new_object(&cv_class, "()V", &[])
        .map_err(|e| e.to_string())?;

    let put_ss = "(Ljava/lang/String;Ljava/lang/String;)V";
    for (k, v) in [
        ("_display_name", filename.as_str()),
        ("mime_type", mime_type),
        ("relative_path", "Download/"),
    ] {
        let jk = env.new_string(k).map_err(|e| e.to_string())?;
        let jv = env.new_string(v).map_err(|e| e.to_string())?;
        env.call_method(&cv, "put", put_ss, &[JValue::Object(&jk), JValue::Object(&jv)])
            .map_err(|e| e.to_string())?;
    }

    // MediaStore.Downloads.EXTERNAL_CONTENT_URI
    let ms_class = env
        .find_class("android/provider/MediaStore$Downloads")
        .map_err(|e| e.to_string())?;
    let ext_uri = env
        .get_static_field(&ms_class, "EXTERNAL_CONTENT_URI", "Landroid/net/Uri;")
        .map_err(|e| e.to_string())?
        .l()
        .map_err(|e| e.to_string())?;

    // Insert row → receive content URI
    let uri = env
        .call_method(
            &resolver,
            "insert",
            "(Landroid/net/Uri;Landroid/content/ContentValues;)Landroid/net/Uri;",
            &[JValue::Object(&ext_uri), JValue::Object(&cv)],
        )
        .map_err(|e| e.to_string())?
        .l()
        .map_err(|e| e.to_string())?;

    if uri.is_null() {
        return Err("MediaStore insert returned null URI".to_string());
    }

    // Open OutputStream and write bytes
    let out_stream = env
        .call_method(
            &resolver,
            "openOutputStream",
            "(Landroid/net/Uri;)Ljava/io/OutputStream;",
            &[JValue::Object(&uri)],
        )
        .map_err(|e| e.to_string())?
        .l()
        .map_err(|e| e.to_string())?;

    let byte_array = env
        .byte_array_from_slice(content.as_bytes())
        .map_err(|e| e.to_string())?;
    let byte_obj = unsafe { JObject::from_raw(byte_array.as_raw()) };
    env.call_method(&out_stream, "write", "([B)V", &[JValue::Object(&byte_obj)])
        .map_err(|e| e.to_string())?;
    env.call_method(&out_stream, "close", "()V", &[])
        .map_err(|e| e.to_string())?;

    // Return the URI string so the toast shows the file location
    let uri_jstr = env
        .call_method(&uri, "toString", "()Ljava/lang/String;", &[])
        .map_err(|e| e.to_string())?
        .l()
        .map_err(|e| e.to_string())?;
    let result: String = env
        .get_string(&JString::from(uri_jstr))
        .map_err(|e| e.to_string())?
        .into();

    Ok(result)
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
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .invoke_handler(tauri::generate_handler![
            save_custom_poster,
            cache_poster,
            get_cached_poster,
            clear_poster_cache,
            get_poster_cache_size,
            write_to_downloads,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
