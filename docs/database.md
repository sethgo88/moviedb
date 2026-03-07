# Database

## Overview

The app uses two databases:
- **SQLite** (local, always available) — primary data store
- **Supabase Postgres** (cloud, online only) — sync mirror

All reads come from SQLite. Supabase is only touched during sync.

---

## SQLite Schema

### `movies` table

```sql
CREATE TABLE IF NOT EXISTS movies (
    id           TEXT PRIMARY KEY,          -- UUID via crypto.randomUUID()
    tmdb_id      INTEGER NOT NULL,          -- TMDB movie ID (not unique — one per copy)
    title        TEXT NOT NULL,
    year         INTEGER NOT NULL,
    poster_url   TEXT,                      -- TMDB w185 URL
    tmdb_rating  REAL,
    personal_rating INTEGER,               -- 1–10, nullable
    status       TEXT NOT NULL,            -- 'OWNED' | 'WANTED'
    format       TEXT NOT NULL,            -- 'HD' | '4K'
    is_physical  INTEGER NOT NULL DEFAULT 0,  -- 0/1 boolean
    is_digital   INTEGER NOT NULL DEFAULT 0,
    is_backed_up INTEGER NOT NULL DEFAULT 0,
    notes        TEXT,
    deleted_at   TEXT,                     -- null = active, ISO 8601 = soft-deleted
    created_at   TEXT NOT NULL,            -- ISO 8601
    updated_at   TEXT NOT NULL             -- ISO 8601 — maintained by trigger
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
        sql: "
            CREATE TABLE movies ( ... );
            CREATE INDEX idx_movies_tmdb_id ON movies (tmdb_id);
            CREATE TRIGGER movies_updated_at ...;
            CREATE TABLE sync_meta ( ... );
            INSERT INTO sync_meta (last_synced_at) VALUES (NULL);
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

## Supabase Schema

Mirror the SQLite schema in Postgres. Key differences:

| SQLite | Supabase Postgres |
|---|---|
| `TEXT` (ISO 8601) for timestamps | `TIMESTAMPTZ` |
| `INTEGER` (0/1) for booleans | `BOOLEAN` |
| `TEXT` UUID | `UUID` |
| Manual trigger for `updated_at` | Same — add a Postgres trigger |

Enable Row Level Security on all tables. Even for personal use — it's a good habit and prevents accidental exposure if the anon key is leaked.

---

## Sync Strategy

### Algorithm: last-write-wins via `updated_at`

1. Read `last_synced_at` from `sync_meta`
2. **PUSH:** Find local rows where `updated_at > last_synced_at AND deleted_at IS NULL` → upsert to Supabase
3. **PUSH DELETES:** Hard delete confirmed soft-deleted rows from Supabase, then locally
4. **PULL:** Fetch Supabase rows where `updated_at > last_synced_at` → upsert to local SQLite
5. Update `sync_meta.last_synced_at` to now

**First sync** (when `last_synced_at IS NULL`): push all local rows, pull all remote rows.

### Conflict resolution

The row with the newer `updated_at` wins. For a single-user personal app this is acceptable. The trigger guarantees `updated_at` is always the true last-modified time.

### Soft delete flow

```
User deletes movie
        ↓
isOnline?
   YES → hard delete locally → sync immediately → delete from Supabase
   NO  → set deleted_at = now → row hidden from UI → queued for sync
        ↓ (next manual sync)
Pending soft deletes exist?
   YES → show DeleteConfirmationView (user selects which to confirm)
       → confirmed: hard delete locally + propagate to Supabase
       → skipped: leave soft delete in place
   NO  → run sync normally
```

**Post-auth sync** (after magic link login) always skips the delete confirmation screen — it just pushes/pulls data. `runSync(skipDeleteConfirmation: true)`.

---

## Poster Cache

Posters are fetched from TMDB and stored locally using Rust Tauri commands:

| Command | Description |
|---|---|
| `cache_poster(tmdbId, url)` | Fetch w185 URL, write to `{appDataDir}/poster-cache/{tmdbId}_w185.jpg` |
| `get_cached_poster(tmdbId)` | Return local file path if it exists and is < 30 days old, else `null` |
| `clear_poster_cache()` | Delete all files in `poster-cache/` |
| `get_poster_cache_size()` | Return total bytes |

Cache limits:
- **Max size:** 100MB — LRU eviction when exceeded
- **TTL:** 30 days per file — re-fetched on next access if stale
- **Size per image:** ~35KB average at w185

The `Poster` atom resolves in order: local cache → TMDB URL → placeholder icon.
