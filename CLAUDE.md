# Movie Collection App — CLAUDE.md

## Workflow Rules

Every task follows this sequence — no skipping steps:

1. **Plan first.** Present a written plan and wait for explicit user approval before writing or modifying any code or files. No exceptions — even for small changes.

2. **Write code.**

3. **Lint + typecheck.** Run `pnpm lint` and `pnpm tsc --noEmit`. Fix all errors before proceeding. Never leave code in a failing state.

4. **Update docs.** Before committing, update any docs that are affected by the change. Use the maintenance table below to determine which files. If a pattern changed, update `docs/patterns.md`. If a schema changed, update `docs/database.md`. And so on.

5. **Commit.** Only after steps 1–4 are complete.

## Edit Tool Rule

**Always Read a file immediately before calling Edit.** Never construct `old_string` from memory or a prior read. Biome reformats files after `pnpm format`, invalidating any earlier read. If Edit fails with "file modified since read", re-read the file and retry — do not fall back to `sed` or Python scripts.

## Git Branching Strategy
- `main` is always stable — never commit directly to it
- **Create a new branch before writing any code for a new phase or feature.** Never commit phase work to a previous phase's branch.
- Branch per phase: `phase/4-sqlite`, `phase/5-pocketbase`, `phase/6-sync`, etc.
- Branch per feature within a phase if the change is self-contained
- Merge to `main` via PR when a phase is complete and stable
- Branch naming: `phase/<n>-<short-description>` for phases, `feat/<short-description>` for features, `fix/<short-description>` for bug fixes
- Check `git branch --show-current` at the start of every session to confirm you are on the right branch before making any changes.

## Project Overview
Tauri 2 + React + TypeScript Android app for tracking a personal movie collection.
Local-first with SQLite, synced to self-hosted PocketBase, movie metadata from TMDB API.

## Stack
- **Frontend:** React 19, TypeScript (strict), Tailwind CSS, Biome
- **Routing:** TanStack Router (fully type-safe, memory history for Tauri Android)
- **Data fetching:** TanStack Query (wraps ALL async calls — SQLite, TMDB, PocketBase)
- **Forms:** TanStack Form (no zod-form-adapter — use Zod v4 `.safeParse()` directly in field validators)
- **State:** Zustand (UI state, filters, optimistic updates)
- **Validation:** Zod v4 (all API responses, forms)
- **Backend/native:** Tauri 2 (Rust), tauri-plugin-sql (SQLite), tauri-plugin-dialog, tauri-plugin-fs
- **Cloud:** PocketBase (self-hosted sync server, REST API)
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
    atoms/        # Button, Badge, Input, Toggle, Select, Slider, PosterPicker, Spinner, Poster
    molecules/    # SearchBar, FormField, ToggleGroup, MovieBadgeGroup, SyncStatus
    organisms/    # MovieCard, MovieGrid, NavBar, FilterPanel
    templates/    # AppLayout, ModalLayout (layout only, no real data)
  views/          # CollectionView, AddMovieView, MovieDetailView, EditMovieView, SettingsView
  features/
    movies/       # movies.store.ts, movies.queries.ts, movies.service.ts, movies.schema.ts, movies.types.ts
    sync/         # sync.store.ts, sync.service.ts, sync.types.ts
    tmdb/         # tmdb.service.ts, tmdb.schema.ts, tmdb.types.ts
  lib/            # db.ts, pocketbase.ts, date.ts, cn.ts (React-free utilities)
  hooks/          # useDebounce.ts, useOnlineStatus.ts, useSync.ts
  types/
    global.d.ts
```

**Rule:** `features/` holds logic only (stores, services, schemas, types). All UI lives in `components/` and `views/`.
**Rule:** One folder per component — even atoms — to allow co-located tests. Each component is a single file named in **lowercase-hyphen** format matching the folder (e.g. `Button/button.tsx`, `MovieCard/movie-card.tsx`). No `index.tsx`, no separate barrel. Imports must include the filename: `import { Button } from '../atoms/Button/button'`.

## Data Model
### SQLite `movies` table (UUID primary keys)
| Column | Type | Notes |
|---|---|---|
| id | TEXT (UUID) | crypto.randomUUID() |
| tmdb_id | INTEGER | nullable — manual entries have no TMDB id |
| title | TEXT | |
| year | INTEGER | nullable |
| poster_url | TEXT | local file path (custom) or TMDB w185 URL |
| tmdb_rating | REAL | nullable |
| personal_rating | REAL | 1–10 in 0.5 steps, nullable. DB column is REAL (migration v2) |
| status | TEXT | 'OWNED' or 'WANTED' |
| format | TEXT | 'SD', 'HD', '4K', or 'CUSTOM' |
| is_physical | INTEGER | 0/1 boolean |
| is_digital | INTEGER | 0/1 boolean |
| is_backed_up | INTEGER | 0/1 boolean — stored in DB but not shown in Add/Edit UI |
| notes | TEXT | nullable |
| deleted_at | TEXT | ISO 8601 — null = active, timestamp = soft-deleted |
| created_at | TEXT | ISO 8601 |
| updated_at | TEXT | ISO 8601 — maintained by trigger, used for sync |

### SQLite `sync_meta` table
Single row: `last_synced_at TEXT` — sync checkpoint, null = never synced.

## Key Architectural Decisions

### TanStack Query for everything async
Use `useQuery` / `useMutation` for ALL async data — SQLite via `movies.service.ts`, TMDB, and PocketBase. Never fetch in `useEffect`. Invalidate query keys after mutations.

### TanStack Form for all forms
Use `@tanstack/react-form`. Do NOT use `@tanstack/zod-form-adapter` — it requires zod@^3 but this project uses zod v4. Instead, validate in field `validators` using Zod's `.safeParse()` directly:
```ts
validators={{
  onBlur: ({ value }) => {
    const result = z.string().min(1, "Required").safeParse(value);
    return result.success ? undefined : result.error.issues[0]?.message;
  },
}}
```

### Memory history for TanStack Router
Use `createMemoryHistory({ initialEntries: ["/"] })` — browser history does not work reliably in Tauri's Android WebView (causes blank screen on deep URL reload).

### Sync strategy: last-write-wins via `updated_at`
- `updated_at` is maintained by a SQLite trigger — never rely on the service layer to set it on UPDATE.
- Soft deletes: `deleted_at` column. All UI queries filter `WHERE deleted_at IS NULL`.
- Manual sync shows a delete confirmation screen for pending soft deletes.
- Post-auth sync skips the delete confirmation screen (`runSync(true)`).

### UUID primary keys
The same movie title can have separate rows for physical vs digital copies. Never assume one row per `tmdb_id`.

### Poster caching
Cache only `w185` sized posters (~35KB each). Two poster flows:
- **Custom (manual entry):** `PosterPicker` atom → Canvas resize to 185px wide → `save_custom_poster` Tauri command → saved as `{appDataDir}/poster-cache/custom_{uuid}_w185.jpg`
- **TMDB (Phase 9):** `cache_poster` Tauri command → fetches from TMDB, saves as `{appDataDir}/poster-cache/{tmdb_id}_w185.jpg`
Display using `convertFileSrc(poster_url)`. LRU eviction at 100MB, 30-day TTL (Phase 9).

### PocketBase credentials
Server URL and auth token stored in Tauri's secure store — never hardcoded, never in `.env` for production.

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
- Android manifest permissions needed: `INTERNET`, `ACCESS_NETWORK_STATE`
- Current Tauri capabilities: `core:default`, `opener:default`, `sql:default`, `sql:allow-execute`, `dialog:allow-open`, `fs:allow-read-file`
- Physical device strongly preferred over emulator for WebView perf testing
- **Phase 3 TODO:** Verify that the Tauri 2 Android back button fires as `"back_button"` event (see `src/hooks/useAndroidBackButton.ts`). Adjust event name if needed.
- Debug keystore auto-generated at `~/.android/debug.keystore`
- Release keystore: stored outside project, credentials in `.env`, never committed

## Poster Cache Tauri Commands (Rust)
| Command | Status | Description |
|---|---|---|
| `save_custom_poster(base64_data)` | ✅ Implemented | Decodes base64 JPEG, saves to `poster-cache/custom_{uuid}_w185.jpg`, returns path |
| `cache_poster(tmdb_id, url)` | ✅ Implemented | Fetch via reqwest, save to `poster-cache/{tmdb_id}_w185.jpg`, return data URL |
| `get_cached_poster(tmdb_id)` | ✅ Implemented | Check local cache, return data URL or null |
| `clear_poster_cache()` | ✅ Implemented | Delete all files in poster-cache/ |
| `get_poster_cache_size()` | ✅ Implemented | Return total bytes for settings display |

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
- [x] Phase 2: Project Scaffolding
- [x] Phase 4: Local Storage — SQLite (migrations, service, queries)
- [x] Phase 5: PocketBase Client & Sync Layer
- [x] Phase 6: Router + Collection View + NavBar
- [x] Phase 7: Add Movie (manual entry — poster picker, form validation, all fields)
- [ ] Phase 3: Android Target Configuration (deferred — verify back_button event name)
- [x] Phase 8: Movie Detail + Edit Movie
- [x] Phase 9: TMDB Integration (search + auto-fill Add Movie form)
- [ ] Phase 10: Settings + Sync UI
- [ ] Phase 11: Polish & QA
