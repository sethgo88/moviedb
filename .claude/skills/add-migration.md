# Skill: add-migration

Add a new SQLite migration to the app.

## What to do

Ask the user what schema change is needed if not described.

### Step 1 — Find the migrations array in `src-tauri/src/lib.rs`

Migrations are defined as a Rust array of `tauri_plugin_sql::Migration` structs, each with a sequential `version` number. Find the highest existing version and add the new one as `version + 1`.

```rust
tauri_plugin_sql::Migration {
    version: <next_version>,
    description: "<short snake_case description>",
    sql: r#"
        -- your SQL here
    "#,
    kind: tauri_plugin_sql::MigrationKind::Up,
},
```

### Step 2 — Write the SQL

Follow these conventions:
- Timestamps: always `TEXT` in ISO 8601 format — SQLite has no native datetime type
- Booleans: always `INTEGER` (0/1) — SQLite has no boolean type
- Primary keys: `TEXT` UUID — use `crypto.randomUUID()` in the service layer, not `AUTOINCREMENT`
- Foreign keys: include them but SQLite requires `PRAGMA foreign_keys = ON` to enforce them
- Indexes: add `CREATE INDEX IF NOT EXISTS idx_<table>_<col> ON <table>(<col>)` for columns used in WHERE/JOIN
- `updated_at` columns: always add the trigger below whenever you add an `updated_at` column

### `updated_at` trigger template
```sql
CREATE TRIGGER IF NOT EXISTS trg_<table>_updated_at
AFTER UPDATE ON <table>
FOR EACH ROW
BEGIN
    UPDATE <table> SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
    WHERE id = OLD.id;
END;
```

### Step 3 — Update TypeScript types

If columns were added or removed, update:
- `src/features/<feature>/<feature>.types.ts` — the TypeScript interface
- `src/features/<feature>/<feature>.schema.ts` — the Zod schema

### Step 4 — Update service functions

If the column change affects queries, update `src/features/<feature>/<feature>.service.ts`.

## Rules
- Never modify existing migration SQL — migrations are immutable once deployed
- Always use `IF NOT EXISTS` / `IF EXISTS` for safety in migration DDL
- Migrations run in version order on first launch — keep them idempotent
- Test by wiping app data (or clearing the DB) and relaunching to trigger fresh migration run
