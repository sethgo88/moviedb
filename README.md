# Movie Tracker

A personal movie collection manager for tracking what you own, what you want, and how you rate it. Letterboxd tracks what you've watched — this tracks what's on your shelf, what format it's in, and what you're hunting for next.

Built as an Android-only app with offline-first storage and TMDB metadata lookup.

---

## Screenshots
<div>
  <img width="599" height="1298" alt="image" src="https://github.com/user-attachments/assets/09c9bc52-dc9e-41fe-8acf-4972cb2e6a60" />
</div>

<div>
  <img width="434" height="1298" alt="image" src="https://github.com/user-attachments/assets/6af38f98-30f1-4b02-a372-bf0e9faef027" />
</div>


---

## Features

**Built and working:**
- Track movies as OWNED or WANTED
- Physical/digital flags — format (SD, HD, 4K), backup status
- Search TMDB for metadata — poster, year, and rating auto-filled on add
- Personal rating (1–10 in 0.5 steps)
- Notes per movie
- Offline-first: all data lives in local SQLite; works without a connection
- Cloud sync to self-hosted PocketBase — last-write-wins on conflict
- Poster images cached locally for offline use

**Planned:**
- Statistics view (collection breakdown by format, rating distribution, etc.)
- Watch history log
- Genre and director fields
- Barcode scanner for quick physical media cataloguing
- Lend tracker — who has what
- Streaming availability via TMDB watch providers
- Batch edit
- Named lists beyond OWNED/WANTED

---

## Stack & Architecture

| Layer | Choice |
|---|---|
| Shell | Tauri 2 (Android target) |
| UI | React 19 + TypeScript strict |
| Styling | Tailwind CSS 4 |
| Routing | TanStack Router (memory history — required for Android WebView) |
| Data fetching | TanStack Query |
| Forms | TanStack Form + Zod v4 |
| Local DB | SQLite via `tauri-plugin-sql` |
| Metadata | TMDB API |
| Cloud | PocketBase (self-hosted sync) |

**One non-obvious decision:** same as the rest of this stack — all database access runs JS-side through `tauri-plugin-sql` rather than Rust commands. The sync strategy is last-write-wins: whichever record has the newer `updated_at` wins on conflict, maintained by a DB trigger (never set from the app layer).

---

## Status

Phase 11 complete. Core collection management and sync work as a daily driver. Planned features above are queued but not yet started.

---

## Setup

Requires the [Tauri Android prerequisites](https://tauri.app/start/prerequisites/#android) (Android Studio, NDK, etc.) and a running PocketBase instance.

```bash
pnpm install
cargo tauri android dev        # dev build on connected device/emulator
cargo tauri android build --debug    # debug APK
cargo tauri android build --release  # release APK
```

PocketBase URL goes in a `.env` file at the project root (not committed):

```
VITE_POCKETBASE_URL=...
```
