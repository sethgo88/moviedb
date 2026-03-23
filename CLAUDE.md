# Movie Collection App — CLAUDE.md

> Global rules (workflow, git, TypeScript, Biome) are in `/c/web/CLAUDE.md`. This file covers only what's specific to this project.

## Project Overview
Tauri 2 + React 19 + TypeScript Android app for tracking a personal movie collection.
Local-first SQLite, synced to self-hosted PocketBase, movie metadata from TMDB API.

## Key Commands
```bash
cargo tauri android dev        # installs debug (io.moviedb.app.dev) — launch error is expected, tap app manually
cargo tauri android build --debug
cargo tauri android build --release
pnpm lint          # biome check .
pnpm format        # biome format --write .
pnpm typecheck     # tsc --noEmit
```

## Stack
React 19, TanStack Router (memory history), TanStack Query, TanStack Form, Zustand, Zod v4, Tailwind CSS, Biome, tauri-plugin-sql (SQLite), PocketBase (sync), TMDB API

## Folder Structure
```
src/
  components/atoms/        # Button, Badge, Input, Toggle, Select, Slider, PosterPicker, Spinner, Poster
  components/molecules/    # SearchBar, FormField, ToggleGroup, MovieBadgeGroup, SyncStatus
  components/organisms/    # MovieCard, MovieGrid, NavBar, FilterPanel, MovieForm
  components/templates/    # AppLayout, ModalLayout
  views/                   # CollectionView, AddMovieView, MovieDetailView, EditMovieView, SettingsView
  features/movies/         # movies.store, movies.queries, movies.service, movies.schema
  features/sync/           # sync.store, sync.service
  features/tmdb/           # tmdb.service, tmdb.schema
  lib/                     # db.ts, pocketbase.ts, cn.ts, date.ts
  hooks/                   # useDebounce, useOnlineStatus, useAndroidBackButton, useSync
```

## Path Aliases
`@/` resolves to `src/`. Use in all imports: `import { db } from '@/lib/db'`

## Data Model
### SQLite `movies` table
| Column | Type | Notes |
|---|---|---|
| id | TEXT (UUID) | crypto.randomUUID() |
| tmdb_id | INTEGER | nullable |
| title | TEXT | |
| year | INTEGER | nullable |
| poster_url | TEXT | local path or TMDB w185 URL |
| tmdb_rating | REAL | nullable |
| personal_rating | REAL | 1–10 in 0.5 steps, nullable |
| status | TEXT | 'OWNED' \| 'WANTED' |
| format | TEXT | 'SD' \| 'HD' \| '4K' \| 'CUSTOM' |
| is_physical | INTEGER | 0/1 |
| is_digital | INTEGER | 0/1 |
| is_backed_up | INTEGER | 0/1 |
| notes | TEXT | nullable |
| deleted_at | TEXT | ISO 8601, null = active |
| created_at | TEXT | ISO 8601 |
| updated_at | TEXT | trigger-maintained |

### SQLite `sync_meta` table
Single row: `last_synced_at TEXT` — null = never synced.

## Key Architectural Decisions
- **Memory history** — `createMemoryHistory({ initialEntries: ['/'] })` required for Android WebView
- **JS-side SQLite** — all DB access via `@tauri-apps/plugin-sql` through `src/lib/db.ts`, no Rust data commands
- **TanStack Query for everything async** — no useEffect for data fetching
- **Zod v4 + safeParse** — no zod-form-adapter; use `.safeParse()` directly in TanStack Form validators
- **updated_at trigger** — never set from app layer on UPDATE; trigger maintains it
- **Soft deletes** — `deleted_at` column; all reads filter `WHERE deleted_at IS NULL`
- **Sync: last-write-wins** — see `.claude/rules/sync.md` for full sync + poster caching rules

## Android
- Bundle ID: `com.yourname.moviecollection`
- Back button: `onBackButtonPress` from `@tauri-apps/api/app` → navigate back or close from root
- Safe areas: `env(safe-area-inset-top/bottom)` — see `docs/android.md`

## Documentation Maintenance
| Change | Update |
|---|---|
| New library | `docs/stack.md` |
| New pattern | `docs/patterns.md` |
| Schema change | `docs/database.md` |
| Tauri command / capability | `docs/android.md` + `docs/architecture.md` |
| Setup step | `docs/setup.md` |
| Data flow / sync | `docs/architecture.md` |

## Task Management

GitHub Issues is the task management system for this project (repo: `sethgo88/moviedb`).

### Issue structure
- Each feature, bug, or work item gets its own issue
- Use sub-issues to break larger tasks into discrete implementation steps
- Label every issue by type: `feature`, `bug`, `chore`, `docs`
- Use milestones to group issues by release or sprint

### Issue format
- **Title:** short and imperative (e.g. "Add offline poster caching")
- **Body:** what needs to be done and why, acceptance criteria, relevant links or context
- **Sub-issues:** one per distinct implementation step

### Workflow
1. Before starting any new work, run `list issues` to check open issues and current priorities
2. Never start work without a corresponding issue — create one first if it doesn't exist
3. **Before touching any file, create or checkout the branch for the issue.** Run `git branch --show-current`; if on `master`, run `git new feat/<description>` (or `fix/`, `phase/` as appropriate). If a branch for the issue already exists, check it out instead.
4. Reference the issue number in every commit message (e.g. `feat: add poster cache, closes #14`)
5. When a task is complete, close the issue and leave a brief comment summarising what was done
6. If work reveals new tasks or edge cases, open new issues rather than expanding scope of the current one
7. **After merging to `master`, always `git pull origin master` then `git push origin master`** to keep the remote in sync

