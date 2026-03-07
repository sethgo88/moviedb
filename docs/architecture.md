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
│   SQLite (local)     │   │   Supabase (cloud)    │
│   tauri-plugin-sql   │   │   @supabase/supabase-js│
│   src/lib/db.ts      │   │   src/lib/supabase.ts  │
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
| `sync` | `sync.service.ts` | Push/pull logic between SQLite and Supabase |
| `sync` | `sync.store.ts` | Sync state — isSyncing, lastSyncedAt, errors |
| `tmdb` | `tmdb.service.ts` | TMDB REST API calls |
| `tmdb` | `tmdb.queries.ts` | TanStack Query hooks for TMDB search/details |
| `tmdb` | `tmdb.schema.ts` | Zod schemas for TMDB API responses |

### `src/lib/`
React-free singletons and utilities:
- `db.ts` — typed wrapper around `@tauri-apps/plugin-sql`
- `supabase.ts` — configured Supabase client
- `cn.ts` — Tailwind class merging utility
- `date.ts` — ISO 8601 helpers

### `src-tauri/src/`
Rust backend. Currently handles:
- SQLite plugin registration and migrations
- Poster cache Tauri commands (`cache_poster`, `get_cached_poster`, etc.)

## Data Flow: Adding a Movie

```
User fills MovieForm
        ↓
useMutation (movies.queries.ts)
        ↓
movies.service.createMovie()   →   db.ts   →   SQLite
        ↓
onSuccess: invalidateQueries(['movies'])
        ↓
useMovies() re-fetches, CollectionView re-renders
        ↓
cache_poster Tauri command fires (async, non-blocking)
        ↓
If online: sync.service.runSync() fires
```

## Data Flow: Sync

```
Manual sync button pressed
        ↓
Check for pending soft deletes (deleted_at IS NOT NULL)
        ↓ (if any)
DeleteConfirmationView shown — user selects which to confirm
        ↓
sync.service.runSync(skipDeleteConfirmation: false)
  ├── PUSH: local rows where updated_at > last_synced_at → Supabase upsert
  ├── PUSH DELETES: confirmed soft deletes → Supabase delete, then hard local delete
  └── PULL: Supabase rows where updated_at > last_synced_at → SQLite upsert
        ↓
Update sync_meta.last_synced_at
        ↓
invalidateQueries(['movies'])
```

## Local-First Principles

1. **All reads come from SQLite.** Supabase is never queried for display data, only for sync.
2. **The app works with no network.** Offline changes accumulate and sync when reconnected.
3. **Soft deletes for safety.** A delete while offline queues the row with `deleted_at` set. The user confirms pending deletes before they propagate to the cloud.
4. **Last-write-wins conflict resolution.** The row with the newer `updated_at` wins during a merge. This is acceptable for a personal app with one user.

## Tauri 2 Capabilities

Tauri 2 uses a capabilities-based permission system. Network access and file system access must be declared in `src-tauri/capabilities/`. If a Tauri API call silently fails, check the capabilities file first.
