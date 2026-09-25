# Architecture

## System Overview

```
┌─────────────────────────────────────────────────┐
│                  React UI Layer                  │
│   views/  →  organisms  →  molecules  →  atoms  │
└────────────────────┬────────────────────────────┘
                     │ hooks / TanStack Query
┌────────────────────▼────────────────────────────┐
│               Feature Layer (src/features/)      │
│   *.queries.ts   *.service.ts   *.store.ts       │
└──────────┬──────────────────────────┬───────────┘
           │                          │
┌──────────▼──────────┐   ┌──────────▼───────────┐
│   SQLite (local)     │   │   Supabase (sync)     │
│   tauri-plugin-sql   │   │   supabase-js SDK     │
│   src/lib/db.ts      │   │   src/lib/supabase.ts │
└─────────────────────┘   └───────────────────────┘
           │
┌──────────▼──────────┐   ┌───────────────────────┐
│   Rust / Tauri       │   │   TMDB API            │
│   poster cache cmds  │   │   src/features/tmdb/  │
│   system APIs        │   │   (search + details)  │
└─────────────────────┘   └───────────────────────┘
```

## Layer Responsibilities

### `src/views/`
Page-level components. Compose organisms with real data. The only place that should own page-level routing logic and layout decisions. One file per route.

### `src/components/`
Pure UI — atoms, molecules, organisms, templates. See [patterns.md](patterns.md) for the atomic design rules. Components receive data as props or read from TanStack Query/Zustand — they never fetch raw data themselves (exception: organisms may use `useQuery` hooks).

### `src/features/`
All business logic. No JSX. Divided by domain:

| Domain | Files | Responsibility |
|---|---|---|
| `movies` | `movies.service.ts` | Raw CRUD against SQLite via `db.ts` |
| `movies` | `movies.queries.ts` | TanStack Query hooks wrapping the service |
| `movies` | `movies.store.ts` | Zustand — UI state, active filters, optimistic state |
| `movies` | `movies.schema.ts` | Zod schemas for the `Movie` domain |
| `movies` | `movies.types.ts` | TypeScript types (inferred from Zod where possible) |
| `sync` | `sync.service.ts` | Push/pull logic between SQLite and Supabase; `resolveConflict()` |
| `sync` | `sync.store.ts` | Sync state — isSyncing, lastSyncedAt, errors, conflicts, pendingSyncMovieId |
| `tmdb` | `tmdb.service.ts` | TMDB REST API calls |
| `tmdb` | `tmdb.queries.ts` | TanStack Query hooks for TMDB search/details |
| `tmdb` | `tmdb.schema.ts` | Zod schemas for TMDB API responses |

### `src/lib/`
React-free singletons and utilities:
- `db.ts` — typed wrapper around `@tauri-apps/plugin-sql`
- `supabase.ts` — typed Supabase client singleton (`createClient<Database>()`)
- `database.types.ts` — generated Supabase schema types
- `cn.ts` — Tailwind class merging utility

### `src-tauri/src/`
Rust backend. Currently handles:
- SQLite plugin registration and migrations (v1: initial schema, v2: personal_rating REAL, v3: type/show_id/season_number columns, v4: sync_meta PRIMARY KEY fix)
- `save_custom_poster` — receives a base64 JPEG data URL from JS; currently unused (custom posters are stored as data URLs directly in `poster_url`)
- `cache_poster(tmdb_id, url)` — fetches TMDB poster via reqwest, saves to poster-cache, returns data URL
- `get_cached_poster(tmdb_id)` — returns cached poster as data URL or null
- `clear_poster_cache()` — deletes all files in poster-cache/ (used by Settings)
- `get_poster_cache_size()` — returns total cache size in bytes (used by Settings)

### Key organisms
- `MovieForm` — shared form used by both `AddMovieView` and `EditMovieView`. Owns TanStack Form state, accepts `initialValues` + `onSubmit` + `onCancel` props.
- `MovieCard` — collection list row (navigates to detail on tap)
- `NavBar` — bottom tab bar (dynamic from NAV_ITEMS array)

### Key molecules
- `ConfirmSheet` — dark bottom sheet for destructive confirmations. Props: `isOpen`, `title`, `message`, `confirmLabel`, `isDangerous`, `onConfirm`, `onCancel`.

## Data Flow: Adding a Movie (manual entry)

```
User fills AddMovieView form (TanStack Form)
        ↓
[Optional] PosterPicker: pick image → Canvas resize 185px wide → JPEG data URL stored in poster_url
        ↓
form.handleSubmit() → NewMovieSchema.parse() → useCreateMovie mutation
        ↓
movies.service.createMovie()   →   db.ts   →   SQLite
        ↓
onSuccess: invalidateQueries(['movies'])
        ↓
useMovies() re-fetches, CollectionView re-renders
        ↓
[Phase 10] If online: sync.service.runSync() fires
```

## Data Flow: Adding a Movie (with TMDB)

```
User taps Search icon in MovieForm header → TmdbSearch sheet opens
        ↓
useTmdbSearch (debounced 400ms) → TMDB /search/movie API
        ↓
User selects result → form fields pre-filled:
  title, year, tmdb_id, tmdb_rating, poster_url (TMDB HTTPS URL)
        ↓
(same as manual entry from here)
```

**Poster storage:** TMDB posters are stored as direct HTTPS URLs
(`https://image.tmdb.org/t/p/w185/...`). The WebView loads them as `<img src>`
just like any other network image. Phase 9 (deferred) will add `cache_poster`
Rust command to download via reqwest (no CORS) and save locally.

**Custom posters** (file picker) are stored as JPEG data URLs (base64-embedded)
because Tauri's asset protocol cannot serve runtime-written files on Android.

## Data Flow: Auto-Sync Triggers

Auto-sync fires from three places — all call the same `runSync()` under the hood:

1. **On mount** (`useAutoSync` in `CollectionView`) — fires once if last sync > 5 min ago or never.
2. **On window focus** (`useAutoSync`) — fires if stale when app is foregrounded.
3. **After any movie mutation** (`movies.queries.ts`) — `requestSyncMovie(id)` sets the movie ID in Zustand; `useAutoSync` debounces 1500 ms then calls `pushOneMovie(id)` to push only that record. Rapid edits to the same movie coalesce into a single push.

The manual "Sync Now" button in SyncView also calls `runSync()` directly.

## Data Flow: Sync

```
runSync() called (auto or manual)
        ↓
PUSH DELETES: any soft-deleted rows → Supabase hard delete, SQLite hard delete
        ↓
Fetch remote meta: SELECT id, updated_at FROM movies (all remote rows)
        ↓
LOCAL DEDUP: detect (tmdb_id, type, season_number) groups with > 1 local row
  → soft-delete strays (queued for push-delete above on next sync)
        ↓
PUSH: for each local active row where:
  - !isInRemote → push (new record)
  - isInRemote AND updated_at > last_synced_at AND remote.updated_at > last_synced_at → CONFLICT (hold back)
  - isInRemote AND updated_at > last_synced_at AND remote.updated_at <= last_synced_at → push (local wins)
  - isInRemote AND updated_at <= last_synced_at → skip (no change)
  - !lastSyncedAt AND isInRemote → skip (first sync — pull wins for existing rows)
  poster_url stripped to null before push if base64 data URL (custom posters are local-only)
        ↓
PULL: Supabase records where deleted_at IS NULL AND updated_at >= last_synced_at
  → skip pushed/conflicted IDs
  → dedup check: if a local row with different ID matches same TMDB content → delete remote stray
  → poster cache: TMDB HTTPS URLs fetched via Rust before INSERT OR REPLACE
  → COALESCE(poster_url): null remote never overwrites local custom poster
        ↓
CONFLICTS: held-back rows stored in useSyncStore.conflicts[]
  → shown in SyncView as ConflictCard (side-by-side diff)
  → user picks "Keep Local" (bump updated_at + push) or "Keep Remote" (INSERT OR REPLACE locally)
        ↓
Update sync_meta.last_synced_at → setConflicts(result.conflicts) → invalidateQueries(['movies'])
```

## Local-First Principles

1. **All reads come from SQLite.** Supabase is never queried for display data, only for sync.
2. **The app works with no network.** Offline changes accumulate; auto-sync catches up on next trigger.
3. **Soft deletes sync automatically.** Deleted rows are pushed to Supabase without confirmation (single-user app).
4. **Last-write-wins + conflict detection.** The row with the newer `updated_at` wins. If both sides changed since last sync, the conflict is surfaced for user resolution rather than silently overwritten.

## Tauri 2 Capabilities

Tauri 2 uses a capabilities-based permission system. Network access and file system access must be declared in `src-tauri/capabilities/`. If a Tauri API call silently fails, check the capabilities file first.
