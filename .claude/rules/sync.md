---
paths:
  - "src/features/sync/**"
---

## Supabase Sync Rules

- **Last-write-wins conflict resolution** — compare `updated_at` on both sides; whichever is newer wins. Never merge fields. The push upsert explicitly carries the SQLite `updated_at` to Supabase to preserve this timestamp across devices — this is a deliberate exception to the "never set `updated_at` from the app layer" rule.
- **sync_meta is a single-row table** — always upsert, never insert a second row. Query: `SELECT last_synced_at FROM sync_meta LIMIT 1`.
- **Soft-deletes sync automatically** — deletes push to Supabase without a confirmation dialog. The app is single-user; auto-sync of deletions is intentional. No `PendingDeletesError` gate.
- **Conflict detection** — if both local and remote `updated_at` are newer than `last_synced_at` for the same row, that is a true conflict. Hold the row back from push, fetch the full remote record, and surface it as a `SyncConflict` in the store. The user resolves via the conflict card in SyncView (Keep Local → bump `updated_at` + push; Keep Remote → INSERT OR REPLACE locally). The `updated_at` bump in `resolveConflict("local")` is a documented sync exception — use `new Date().toISOString()` (not `datetime('now')`) to keep the format consistent with all other timestamps.
- **First sync (lastSyncedAt null)** — only push rows that don't already exist in Supabase. Remote rows win on first sync: rows already in remote are left for the pull phase to bring down. This prevents a fresh install overwriting existing cloud data.
- **Supabase credentials** — URL and anon key stored in `localStorage` (anon key is not a secret; RLS enforces row-level security). The Supabase JS client stores the session token in `localStorage` automatically.
- **Supabase ID mapping** — the SQLite `id` (UUID) is used directly as the Supabase `id`. No `local_id` indirection. Upsert with `onConflict: 'id'`.
- **Boolean conversion** — SQLite stores booleans as 0/1; Postgres stores them as true/false. Convert on push (`Boolean(row.is_physical)`) and on pull (`boolInt(validated.is_physical)`).
- **Poster caching strategy** — custom posters saved as JPEG base64 data URLs stored directly in `poster_url`. TMDB posters stored as direct HTTPS `w185` URLs (not downloaded). Never mix these patterns.
- **Android HTTP bypass** — pass `tauriFetch` via `createClient(url, anonKey, { global: { fetch: tauriFetch } })` to route all Supabase requests through Tauri's Rust HTTP client, bypassing Android WebView interception.
