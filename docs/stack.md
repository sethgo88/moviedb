# Stack Guide

Each technology in the project — why it was chosen and what you need to know to use it correctly.

---

## Tauri 2

**What:** Native app shell that wraps a web UI (React) and provides a Rust backend for system APIs.
**Why:** Delivers a true native Android APK with access to the file system, SQLite, and system storage — without the overhead of Electron. Tauri 2 has first-class Android support.

**Key concepts:**
- The frontend is a standard web app (Vite + React) running in the system WebView
- The Rust backend exposes typed **commands** that the frontend calls via `invoke()`
- **Capabilities** (`src-tauri/capabilities/`) declare what APIs the app can use — network, file system, etc. Missing capability = silent failure
- Plugins extend Tauri with functionality: `tauri-plugin-sql` for SQLite, `tauri-plugin-http` for image fetching

**In this project:**
- `src-tauri/src/lib.rs` — plugin registration, migration definitions
- `src-tauri/src/main.rs` — entry point, just calls `lib::run()`
- Custom Rust commands live in `src-tauri/src/lib.rs` (poster cache)

---

## React 19 + TypeScript

**What:** UI library + type system.
**Why:** React is the default Tauri frontend. TypeScript strict mode catches entire classes of bugs at compile time.

**Rules:**
- `"strict": true` in `tsconfig.json` — always on, no exceptions
- No `any` — use `unknown` and narrow, or write the proper type
- No `useEffect` for data fetching — use TanStack Query (see below)
- Functional components only, typed with `FC<Props>` or inline `({ prop }: Props) =>`

---

## Tailwind CSS

**What:** Utility-first CSS framework.
**Why:** No context switching between CSS files. Co-located styles. Dark mode with `dark:` variants is trivial.

**Setup in this project:** Uses the Vite plugin (`@tailwindcss/vite`) and `@import "tailwindcss"` in the main CSS file.

**Rules:**
- `dark:` variant on every color class — dark mode is required throughout
- No inline styles, no CSS modules, no `styled-components`
- Use `cn()` from `src/lib/cn.ts` for conditional class composition
- Touch targets minimum `min-h-[48px] min-w-[48px]` for Android (48dp guideline)

---

## Biome

**What:** Unified linter and formatter (replaces ESLint + Prettier).
**Why:** Single tool, faster, no config conflicts between lint and format rules.

**Commands:**
```bash
pnpm lint      # biome check . — lint only, no changes
pnpm format    # biome format --write . — auto-fix formatting
```

**Rules:**
- No ESLint config, no Prettier config — Biome only
- `pnpm lint` must pass with zero warnings before any feature is done
- Config lives in `biome.json` in the project root

---

## TanStack Router

**What:** Type-safe file-based (or code-based) router for React.
**Why:** Route params and search params are fully typed — no runtime string parsing, no `useParams()` returning `string | undefined`.

**Key concepts:**
- Routes and their params are part of the TypeScript type system
- Define routes in `src/routes/` (or as a route tree)
- Use `useNavigate`, `useParams`, `useSearch` from `@tanstack/react-router` — not `react-router-dom`

---

## TanStack Query

**What:** Async state manager — caching, background refetch, loading/error states.
**Why:** Eliminates manual `useEffect` data fetching, loading state booleans, and cache invalidation bugs. Works identically for SQLite, TMDB, and Supabase calls.

**This is the most important architectural rule:** every async operation goes through TanStack Query.

**Pattern:**
```ts
// In *.queries.ts
export function useMovies() {
  return useQuery({
    queryKey: ['movies'],
    queryFn: () => moviesService.getAllMovies(),
  })
}

export function useCreateMovie() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: CreateMovie) => moviesService.createMovie(data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['movies'] }),
  })
}
```

**Rules:**
- `queryKey` must include all variables the query depends on: `['movies', { status }]`
- Invalidate the relevant query key in `onSuccess` after mutations
- Never call service functions directly in components — always go through a query/mutation hook
- Query hooks live in `*.queries.ts` files, not inside components

---

## Zustand

**What:** Lightweight React state management.
**Why:** Minimal boilerplate for UI state that doesn't belong in the server cache (filters, selections, sync status indicators).

**What goes in Zustand vs TanStack Query:**

| Zustand | TanStack Query |
|---|---|
| Active filter selections | Movie list from SQLite |
| Sync status (isSyncing, lastSyncedAt) | TMDB search results |
| Pending delete count badge | Any async data with loading/error state |
| UI toggles | |

**Pattern:**
```ts
// In *.store.ts
interface MoviesStore {
  activeStatus: 'OWNED' | 'WANTED' | null
  activeFormat: 'HD' | '4K' | null
  setActiveStatus: (s: MoviesStore['activeStatus']) => void
}

export const useMoviesStore = create<MoviesStore>((set) => ({
  activeStatus: null,
  activeFormat: null,
  setActiveStatus: (activeStatus) => set({ activeStatus }),
}))
```

---

## Zod

**What:** Runtime schema validation and TypeScript type inference.
**Why:** TypeScript types are erased at runtime. Zod validates that external data (TMDB responses, Supabase rows) actually matches what the types say.

**Pattern — infer types from schemas:**
```ts
// In *.schema.ts
export const MovieSchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  status: z.enum(['OWNED', 'WANTED']),
  // ...
})

// In *.types.ts (or same file)
export type Movie = z.infer<typeof MovieSchema>
```

**Rules:**
- Validate at system boundaries: TMDB API responses, Supabase results, form submissions
- Do not validate data that never leaves the app (e.g., internal state from a Zustand store)
- Keep schemas in `*.schema.ts`, types in `*.types.ts` (or infer the type in the schema file)

---

## tauri-plugin-sql (SQLite)

**What:** Tauri plugin that gives the frontend JavaScript access to SQLite via typed Rust bindings.
**Why:** True embedded SQLite — no network, no server, works offline. Data survives app restarts.

**Key concepts:**
- The JS API is async (`await db.select(...)`, `await db.execute(...)`)
- All access goes through `src/lib/db.ts` — never import the plugin directly in feature code
- Migrations are defined in Rust (`src-tauri/src/lib.rs`) and run automatically on launch

**SQLite type mapping:**

| TypeScript | SQLite | Notes |
|---|---|---|
| `string` (UUID) | `TEXT` | Primary keys |
| `string` (ISO 8601) | `TEXT` | Dates — no native datetime |
| `boolean` | `INTEGER` | 0 = false, 1 = true |
| `number` | `REAL` or `INTEGER` | |
| `string \| null` | `TEXT` | Nullable columns |

**See [database.md](database.md) for schema and migration guide.**

---

## Supabase

**What:** Hosted Postgres + auth + realtime (we use Postgres + auth only).
**Why:** Free tier, generous limits, magic link auth, Row Level Security built in.

**In this project:**
- Mirrors the SQLite schema in Postgres
- Used only for sync (push/pull) and auth — never for live reads
- Magic link email auth — no passwords
- RLS policies required even for personal use

**Client:** `src/lib/supabase.ts` — configured singleton.
**Keys:** Stored in Tauri's secure store, not in `.env` for production.

---

## Vitest

**What:** Unit test framework, Vite-native.
**Why:** Zero config with Vite — same transform pipeline as the app.

**Run:** `pnpm test`

**What to test:**
- `*.service.ts` functions — mock the DB, assert correct SQL/results
- `*.schema.ts` — valid and invalid inputs
- `sync.service.ts` — mock `isOnline` and Supabase client
- Complex form components — render, validate, submit
