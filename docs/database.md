# Database

## Overview

The app uses two databases:
- **SQLite** (local, always available) — primary data store
- **Supabase** (hosted Postgres) — sync mirror

All reads come from SQLite. Supabase is only touched during sync.

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

## Supabase Table Schema

The Supabase `movies` table mirrors the SQLite schema. Key differences between SQLite and Postgres:

| SQLite | Supabase (Postgres) |
|---|---|
| `TEXT` UUID primary key | `uuid` primary key — same UUID value used directly, no mapping layer |
| `INTEGER` (0/1) for booleans | `boolean` (`true`/`false`) — convert on push (`Boolean(n)`) and pull (`boolInt(b)`) |
| `TEXT` (ISO 8601) for timestamps | `timestamptz` — stored and returned as ISO 8601 strings |
| `REAL` for ratings | `numeric` / `float8` |

### ID mapping
The SQLite UUID is used directly as the Supabase `id`. No `local_id` indirection. Upsert uses `onConflict: 'id'`.

### Auth and RLS
Supabase uses email/password auth (or OAuth). The session is stored automatically in `localStorage` by the Supabase JS client. Each row includes a `user_id` column (set to `session.user.id` on push) and Row Level Security (RLS) policies restrict reads/writes to the owning user.

### Generated types
`src/lib/database.types.ts` is the Supabase-generated TypeScript schema (`Database`, `Tables<"movies">`, etc.). The Supabase client is typed: `createClient<Database>()`. Regenerate with:
```bash
npx supabase gen types typescript --project-id <project-id> > src/lib/database.types.ts
```

---

## Sync Strategy

### Algorithm: last-write-wins via `updated_at`

1. Read `last_synced_at` from `sync_meta`
2. **LOCAL DEDUP:** Find local rows that share the same `(tmdb_id, type, season_number)` — keep the most-recently-updated, soft-delete the rest. Prevents a push-every-other-sync loop caused by duplicate UUIDs for the same content.
3. **PUSH DELETES:** Hard delete confirmed soft-deleted rows from Supabase, then locally.
4. **PUSH:** All local active rows checked against Supabase — push (upsert on `id`) if missing from remote OR `updated_at > last_synced_at`. Custom poster data URLs are stripped to `null` before push (local-only). `updated_at` is explicitly carried from SQLite to preserve last-write-wins semantics across devices (documented exception to the "trigger maintains updated_at" rule).
5. **PULL:** Fetch Supabase records where `updated_at ≥ last_synced_at` and `deleted_at IS NULL` → upsert to local SQLite. `poster_url` uses `COALESCE` so a null remote value never overwrites a local custom poster.
6. Update `sync_meta.last_synced_at` to now.

**First sync** (when `last_synced_at IS NULL`): push all local rows, pull all remote records.

### Conflict resolution

The row with the newer `updated_at` wins. For a single-user personal app this is acceptable.

### Soft delete flow

```
User deletes movie
        ↓
set deleted_at = now → row hidden from UI → queued for sync
        ↓ (next manual sync)
Pending soft deletes exist?
   YES → show confirmation (user confirms before propagating)
       → confirmed: delete from Supabase + hard-delete locally
       → skipped: leave soft delete in place
   NO  → run sync normally
```

`runSync(skipDeleteConfirmation: true)` bypasses the confirmation (used for programmatic sync).

---

## Poster Storage

Two poster sources, both stored in `poster_url`:

### Custom posters (file picker)
`PosterPicker` → user picks image → Canvas resize to 185px wide → `canvas.toDataURL("image/jpeg", 0.85)` → JPEG data URL stored directly in `poster_url`. The Tauri asset protocol cannot serve runtime-written files on Android, so data URLs are used instead of file paths.

### TMDB posters
Stored as direct HTTPS URLs (`https://image.tmdb.org/t/p/w185/...`). The WebView loads them as `<img src>` like any other network image. No local caching is implemented.
