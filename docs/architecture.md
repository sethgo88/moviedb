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
│   SQLite (local)     │   │   PocketBase (sync)   │
│   tauri-plugin-sql   │   │   pocketbase JS SDK   │
│   src/lib/db.ts      │   │   src/lib/pocketbase.ts│
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
| `sync` | `sync.service.ts` | Push/pull logic between SQLite and PocketBase |
| `sync` | `sync.store.ts` | Sync state — isSyncing, lastSyncedAt, errors |
| `tmdb` | `tmdb.service.ts` | TMDB REST API calls |
| `tmdb` | `tmdb.queries.ts` | TanStack Query hooks for TMDB search/details |
| `tmdb` | `tmdb.schema.ts` | Zod schemas for TMDB API responses |

### `src/lib/`
React-free singletons and utilities:
- `db.ts` — typed wrapper around `@tauri-apps/plugin-sql`
- `pocketbase.ts` — configured PocketBase client
- `cn.ts` — Tailwind class merging utility
- `date.ts` — ISO 8601 helpers

### `src-tauri/src/`
Rust backend. Currently handles:
- SQLite plugin registration and migrations (v1: initial schema, v2: personal_rating REAL)
- `save_custom_poster` — decodes base64 JPEG and saves to poster-cache directory
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
[Optional] PosterPicker: pick image → Canvas resize 185px wide
        → invoke save_custom_poster → poster-cache/custom_{uuid}_w185.jpg
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

## Data Flow: Sync

```
Manual sync button pressed
        ↓
Check for pending soft deletes (deleted_at IS NOT NULL)
        ↓ (if any)
DeleteConfirmationView shown — user selects which to confirm
        ↓
sync.service.runSync(skipDeleteConfirmation: false)
  ├── PUSH: local rows where updated_at > last_synced_at → PocketBase upsert
  ├── PUSH DELETES: confirmed soft deletes → PocketBase delete, then hard local delete
  └── PULL: PocketBase records where updated_at > last_synced_at → SQLite upsert
        ↓
Update sync_meta.last_synced_at
        ↓
invalidateQueries(['movies'])
```

## Local-First Principles

1. **All reads come from SQLite.** PocketBase is never queried for display data, only for sync.
2. **The app works with no network.** Offline changes accumulate and sync when connected to the home network.
3. **Soft deletes for safety.** A delete while offline queues the row with `deleted_at` set. The user confirms pending deletes before they propagate to PocketBase.
4. **Last-write-wins conflict resolution.** The row with the newer `updated_at` wins during a merge. This is acceptable for a personal app with one user.

## Tauri 2 Capabilities

Tauri 2 uses a capabilities-based permission system. Network access and file system access must be declared in `src-tauri/capabilities/`. If a Tauri API call silently fails, check the capabilities file first.
