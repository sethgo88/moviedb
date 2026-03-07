# Movie Collection App — CLAUDE.md

## Workflow Rules
**Always present a written plan and wait for explicit user approval before writing or modifying any code or files.** No exceptions — even for small changes.

**After every code change, and before moving on to the next task, always run `pnpm lint` and `pnpm tsc --noEmit`.** Fix all errors and warnings before proceeding. Never leave code in a state that fails lint or type-check.

## Git Branching Strategy
- `main` is always stable — never commit directly to it
- Branch per phase: `phase/4-sqlite`, `phase/5-supabase`, `phase/6-sync`, etc.
- Branch per feature within a phase if the change is self-contained
- Merge to `main` via PR when a phase is complete and stable
- Branch naming: `phase/<n>-<short-description>` for phases, `feat/<short-description>` for features, `fix/<short-description>` for bug fixes

## Project Overview
Tauri 2 + React + TypeScript Android app for tracking a personal movie collection.
Local-first with SQLite, synced to Supabase, movie metadata from TMDB API.

## Stack
- **Frontend:** React 19, TypeScript (strict), Tailwind CSS, Biome
- **Routing:** TanStack Router (fully type-safe)
- **Data fetching:** TanStack Query (wraps ALL async calls — SQLite, TMDB, Supabase)
- **State:** Zustand (UI state, filters, optimistic updates)
- **Validation:** Zod (all API responses, forms)
- **Backend/native:** Tauri 2 (Rust), tauri-plugin-sql (SQLite)
- **Cloud:** Supabase (Postgres mirror, auth via magic link)
- **Package manager:** pnpm

## Key Commands
```bash
pnpm dev                  # desktop dev server (cargo tauri dev)
cargo tauri dev           # same — desktop
cargo tauri android dev   # run on connected Android device / emulator
cargo tauri android build --debug    # debug APK
cargo tauri android build --release  # signed release APK
pnpm lint                 # biome check .
pnpm format               # biome format --write .
pnpm tsc --noEmit         # type-check only
pnpm test                 # vitest
```

## Folder Structure (Atomic Design)
```
src/
  components/
    atoms/        # Button, Badge, Input, Spinner, Text, Poster, Icon
    molecules/    # SearchBar, MovieBadgeGroup, FormField, SyncStatus
    organisms/    # MovieCard, MovieGrid, MovieForm, NavBar, FilterPanel
    templates/    # AppLayout, ModalLayout (layout only, no real data)
  views/          # CollectionView, WishlistView, MovieDetailView, AddMovieView, SettingsView
  features/
    movies/       # movies.store.ts, movies.queries.ts, movies.service.ts, movies.schema.ts, movies.types.ts
    sync/         # sync.store.ts, sync.service.ts, sync.types.ts
    tmdb/         # tmdb.service.ts, tmdb.schema.ts, tmdb.types.ts
  lib/            # db.ts, supabase.ts, date.ts, cn.ts (React-free utilities)
  hooks/          # useDebounce.ts, useOnlineStatus.ts, useSync.ts
  types/
    global.d.ts
```

**Rule:** `features/` holds logic only (stores, services, schemas, types). All UI lives in `components/` and `views/`.
**Rule:** One folder per component — even atoms — to allow co-located tests.

## Data Model
### SQLite `movies` table (UUID primary keys)
| Column | Type | Notes |
|---|---|---|
| id | TEXT (UUID) | crypto.randomUUID() |
| tmdb_id | INTEGER | indexed — same movie can have multiple rows (physical + digital) |
| title | TEXT | |
| year | INTEGER | |
| poster_url | TEXT | TMDB w185 URL |
| tmdb_rating | REAL | |
| personal_rating | INTEGER | 1–10, nullable |
| status | TEXT | 'OWNED' or 'WANTED' |
| format | TEXT | 'HD' or '4K' |
| is_physical | INTEGER | 0/1 boolean |
| is_digital | INTEGER | 0/1 boolean |
| is_backed_up | INTEGER | 0/1 boolean |
| notes | TEXT | nullable |
| deleted_at | TEXT | ISO 8601 — null = active, timestamp = soft-deleted |
| created_at | TEXT | ISO 8601 |
| updated_at | TEXT | ISO 8601 — maintained by trigger, used for sync |

### SQLite `sync_meta` table
Single row: `last_synced_at TEXT` — sync checkpoint, null = never synced.

## Key Architectural Decisions

### TanStack Query for everything async
Use `useQuery` / `useMutation` for ALL async data — SQLite via `movies.service.ts`, TMDB, and Supabase. Never fetch in `useEffect`. Invalidate query keys after mutations.

### Sync strategy: last-write-wins via `updated_at`
- `updated_at` is maintained by a SQLite trigger — never rely on the service layer to set it on UPDATE.
- Soft deletes: `deleted_at` column. All UI queries filter `WHERE deleted_at IS NULL`.
- Manual sync shows a delete confirmation screen for pending soft deletes.
- Post-auth sync skips the delete confirmation screen (`runSync(true)`).

### UUID primary keys
The same movie title can have separate rows for physical vs digital copies. Never assume one row per `tmdb_id`.

### Poster caching
Cache only `w185` TMDB posters (~35KB each). Store in `{appDataDir}/poster-cache/{tmdb_id}_w185.jpg`. LRU eviction at 100MB, 30-day TTL. The `Poster` atom falls back: local cache → TMDB URL → placeholder.

### Supabase keys
Store in Tauri's secure store — never hardcoded, never in `.env` for production.

## TypeScript Rules
- `"strict": true` — no exceptions
- No `any` — use `unknown` and narrow, or proper types
- All Zod schemas in `*.schema.ts`, infer types from them where possible
- Enums as `const` objects or Zod enums — not TypeScript `enum` keyword

## Biome Rules
- Biome is the linter and formatter — no ESLint, no Prettier
- Run `pnpm lint` before committing — zero warnings policy

## Android Notes
- Bundle ID: `com.yourname.moviecollection` (set in `tauri.conf.json`)
- Capabilities file: `src-tauri/capabilities/` (Tauri 2.x system)
- Permissions needed: `INTERNET`, `ACCESS_NETWORK_STATE`
- Physical device strongly preferred over emulator for WebView perf testing
- Debug keystore auto-generated at `~/.android/debug.keystore`
- Release keystore: stored outside project, credentials in `.env`, never committed

## Poster Cache Tauri Commands (Rust)
| Command | Description |
|---|---|
| `get_cached_poster` | Check local cache, return path or None |
| `cache_poster` | Fetch w185 URL, write to cache, return local path |
| `clear_poster_cache` | Delete all files in poster-cache/ |
| `get_poster_cache_size` | Return total bytes for settings display |

## Documentation Maintenance

The `docs/` folder contains the developer-facing documentation for this project. **Keep it current as the codebase evolves.**

### When to update docs

| Change | Update |
|---|---|
| New library added or removed | `docs/stack.md` |
| New pattern established or old one changed | `docs/patterns.md` |
| Schema change, new migration | `docs/database.md` |
| New Tauri command, capability, or permission | `docs/android.md` and `docs/architecture.md` |
| New feature module or component convention | `docs/patterns.md` and `docs/architecture.md` |
| Setup step changes (new tool, env var, etc.) | `docs/setup.md` |
| Data flow changes (sync, poster cache, etc.) | `docs/architecture.md` |

### Rules
- Update docs in the same session as the code change — never leave them to drift
- If you add a new file or folder that changes the folder structure in `docs/architecture.md`, update the diagram
- If a pattern in `docs/patterns.md` becomes outdated (e.g., a library is swapped), rewrite the relevant section — don't leave stale examples
- If a troubleshooting step in `docs/android.md` proves wrong or incomplete, fix it immediately
- `CLAUDE.md` is the quick-reference for Claude; `docs/` is the full human-readable onboarding suite — both must stay in sync with each other

## Phase Status
- [x] Phase 1: Environment Setup
- [x] Phase 2: Project Scaffolding (scaffold exists, structure TBD)
- [ ] Phase 3: Android Target Configuration
- [ ] Phase 4: Local Storage — SQLite
- [ ] Phase 5: Cloud Storage — Supabase
- [ ] Phase 6: Sync
- [ ] Phase 7: Core App Features
- [ ] Phase 8: Polish & QA
