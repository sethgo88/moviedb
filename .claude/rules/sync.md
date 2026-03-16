---
paths:
  - "src/features/sync/**"
---

## PocketBase Sync Rules

- **Last-write-wins conflict resolution** — compare `updated_at` on both sides; whichever is newer wins. Never merge fields.
- **sync_meta is a single-row table** — always upsert, never insert a second row. Query: `SELECT last_synced_at FROM sync_meta LIMIT 1`.
- **Pending soft-deletes** — on sync, show a confirmation dialog before pushing deletes to PocketBase. Movies deleted locally while offline should not silently disappear from the cloud.
- **PocketBase credentials** — stored in Tauri secure store, never in `.env` or hardcoded. Load via `@tauri-apps/plugin-store` before initialising the PocketBase client.
- **Poster caching strategy** — custom posters saved as JPEG base64 data URLs stored directly in `poster_url`. TMDB posters stored as direct HTTPS `w185` URLs (not downloaded). Never mix these patterns.
