# Database

## Overview

The app uses two databases:
- **SQLite** (local, always available) — primary data store
- **PocketBase** (self-hosted, home network) — sync mirror

All reads come from SQLite. PocketBase is only touched during sync.

---

## SQLite Schema

### `movies` table

```sql
CREATE TABLE IF NOT EXISTS movies (
    id           TEXT PRIMARY KEY,          -- UUID via crypto.randomUUID()
    tmdb_id      INTEGER,                   -- nullable — manual entries have no TMDB id
    title        TEXT NOT NULL,
    year         INTEGER,                   -- nullable — can be unknown at entry time
    poster_url   TEXT,                      -- local file path or TMDB w185 URL
    tmdb_rating  REAL,
    personal_rating REAL,                  -- 1–10 in 0.5 steps, nullable (REAL since migration v2)
    status       TEXT NOT NULL,            -- 'OWNED' | 'WANTED'
    format       TEXT NOT NULL,            -- 'SD' | 'HD' | '4K' | 'CUSTOM'
    is_physical  INTEGER NOT NULL DEFAULT 0,  -- 0/1 boolean
    is_digital   INTEGER NOT NULL DEFAULT 0,
    is_backed_up INTEGER NOT NULL DEFAULT 0,  -- stored but not shown in UI
    notes        TEXT,
    deleted_at   TEXT,                     -- null = active, ISO 8601 = soft-deleted
    created_at   TEXT NOT NULL,            -- ISO 8601
    updated_at   TEXT NOT NULL,            -- ISO 8601 — maintained by trigger
    type         TEXT NOT NULL DEFAULT 'MOVIE',  -- 'MOVIE' | 'TV_SHOW' | 'TV_SEASON' | 'TV_EPISODE'
    show_id      TEXT,                     -- UUID ref to parent TV show row (nullable)
    season_number INTEGER                  -- season number for TV_SEASON rows (nullable)
);

CREATE INDEX IF NOT EXISTS idx_movies_tmdb_id ON movies(tmdb_id);
```

**Why UUID primary keys?**
The same TMDB movie can have multiple rows — one for a physical copy and one for a digital copy. UUID keys mean there's no ambiguity and rows can be created on any device without coordination.

**Why TEXT for dates?**
SQLite has no native datetime type. ISO 8601 strings (`2024-03-15T10:30:00.000Z`) sort and compare correctly as strings, which is all the sync logic needs.

**Why INTEGER for booleans?**
SQLite has no boolean type. `0` = false, `1` = true. The TypeScript layer converts these.

### `updated_at` trigger

This trigger fires on every UPDATE and refreshes `updated_at` automatically. **Do not rely on the service layer to update this column** — the trigger enforces it for every update path.

```sql
CREATE TRIGGER movies_updated_at
AFTER UPDATE ON movies
FOR EACH ROW
BEGIN
    UPDATE movies
    SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
    WHERE id = OLD.id;
END;
```

### `sync_meta` table

```sql
CREATE TABLE sync_meta (
    last_synced_at TEXT  -- null = never synced
);

INSERT INTO sync_meta (last_synced_at) VALUES (NULL);
```

Stores the timestamp of the last successful sync. The sync service queries this to know what to push and pull.

---

## Migrations

Migrations live in `src-tauri/src/lib.rs` as a Rust array. They run in version order on every app launch (skipping already-applied versions).

```rust
let migrations = vec![
    tauri_plugin_sql::Migration {
        version: 1,
        description: "create_initial_tables",
        sql: "CREATE TABLE movies ( ... ); ...",
        kind: tauri_plugin_sql::MigrationKind::Up,
    },
    tauri_plugin_sql::Migration {
        version: 2,
        description: "personal_rating_real",
        sql: "
            -- Recreate movies with personal_rating REAL instead of INTEGER
            -- (SQLite doesn't support ALTER COLUMN, so table recreation is required)
            CREATE TABLE movies_new ( ... personal_rating REAL ... );
            INSERT INTO movies_new SELECT * FROM movies;
            DROP TABLE movies;
            ALTER TABLE movies_new RENAME TO movies;
            CREATE INDEX idx_movies_tmdb_id ON movies (tmdb_id);
            CREATE TRIGGER movies_updated_at ...;
        ",
        kind: tauri_plugin_sql::MigrationKind::Up,
    },
    tauri_plugin_sql::Migration {
        version: 3,
        description: "add_type_show_id_season_number",
        sql: "
            ALTER TABLE movies ADD COLUMN type TEXT NOT NULL DEFAULT 'MOVIE';
            ALTER TABLE movies ADD COLUMN show_id TEXT;
            ALTER TABLE movies ADD COLUMN season_number INTEGER;
        ",
        kind: tauri_plugin_sql::MigrationKind::Up,
    },
    // Add new migrations here — never modify existing ones
];
```

**Rules:**
- Never modify existing migration SQL — it has already run on deployed devices
- Each migration is immutable once released
- Always use `IF NOT EXISTS` / `IF EXISTS` in DDL
- New column? New migration. New table? New migration.

**Adding a migration:** Use `/add-migration` skill — it handles version numbering and trigger boilerplate.

---

## PocketBase Collection Schema

PocketBase uses collections (analogous to tables). The `movies` collection mirrors the SQLite schema with these differences:

| SQLite | PocketBase |
|---|---|
| `TEXT` UUID primary key | PocketBase generates its own `id` (15-char string) — store local UUID in a separate `local_id` field |
| `INTEGER` (0/1) for booleans | `Bool` field type |
| `TEXT` (ISO 8601) for timestamps | `Date` field type |
| `REAL` for ratings | `Number` field type |

### Sync ID mapping
Because PocketBase generates its own IDs, each record stores the local SQLite UUID in a `local_id` text field. Sync uses `local_id` to match remote records to local rows.

### Auth
PocketBase supports simple username/password auth. Store the server URL and auth token in Tauri's secure store — never hardcode them.

---

## Sync Strategy

### Algorithm: last-write-wins via `updated_at`

1. Read `last_synced_at` from `sync_meta`
2. **PUSH:** Find local rows where `updated_at > last_synced_at AND deleted_at IS NULL` → upsert to PocketBase (match on `local_id`)
3. **PUSH DELETES:** Hard delete confirmed soft-deleted rows from PocketBase, then locally
4. **PULL:** Fetch PocketBase records where `updated_at > last_synced_at` → upsert to local SQLite (match on `local_id`)
5. Update `sync_meta.last_synced_at` to now

**First sync** (when `last_synced_at IS NULL`): push all local rows, pull all remote records.

### Conflict resolution

The row with the newer `updated_at` wins. For a single-user personal app this is acceptable. The trigger guarantees `updated_at` is always the true last-modified time.

### Soft delete flow

```
User deletes movie
        ↓
isOnline?
   YES → hard delete locally → sync immediately → delete from PocketBase
   NO  → set deleted_at = now → row hidden from UI → queued for sync
        ↓ (next manual sync)
Pending soft deletes exist?
   YES → show DeleteConfirmationView (user selects which to confirm)
       → confirmed: hard delete locally + propagate to PocketBase
       → skipped: leave soft delete in place
   NO  → run sync normally
```

**Post-auth sync** (after magic link login) always skips the delete confirmation screen — it just pushes/pulls data. `runSync(skipDeleteConfirmation: true)`.

---

## Poster Storage

Two poster sources, both stored in `poster_url`:

### Custom posters (file picker)
`PosterPicker` → user picks image → Canvas resize to 185px wide → `canvas.toDataURL("image/jpeg", 0.85)` → JPEG data URL stored directly in `poster_url`. The Tauri asset protocol cannot serve runtime-written files on Android, so data URLs are used instead of file paths.

### TMDB posters
Stored as direct HTTPS URLs (`https://image.tmdb.org/t/p/w185/...`). The WebView loads them as `<img src>` like any other network image. No local caching is implemented.
