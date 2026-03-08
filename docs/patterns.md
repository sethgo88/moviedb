# Code Patterns

Concrete, copy-paste-ready patterns used throughout the codebase. When in doubt, follow these.

---

## Atomic Design — Component Levels

```
atoms      Smallest indivisible UI unit. No sub-components from this project.
           Examples: Button, Badge, Input, Spinner, Text, Poster, Icon

molecules  Two or more atoms forming a simple cohesive unit.
           Examples: SearchBar, FormField, MovieBadgeGroup, SyncStatus

organisms  Complex, self-contained sections. May use Query hooks or Zustand.
           Examples: MovieCard, MovieGrid, MovieForm, NavBar, FilterPanel

templates  Layout shells with no real data — just children/slots.
           Examples: AppLayout, ModalLayout

views      Templates + real data. One per route.
           Examples: CollectionView, WishlistView, MovieDetailView
```

**Rule:** `features/` has no JSX. `components/` and `views/` have no raw DB or API calls.

---

## File Structure — One Component Per Folder

Every component, even atoms, lives in its own folder. The implementation file is named after the component in **lowercase-hyphen** format (not `index.tsx`):

```
src/components/atoms/Button/
  button.tsx         ← implementation (export directly, no separate barrel)
  button.test.tsx    ← optional, co-located

src/components/molecules/ConfirmSheet/
  confirm-sheet.tsx

src/components/organisms/MovieCard/
  movie-card.tsx
```

Import consumers use the full path including the filename:
```ts
import { Button } from '../components/atoms/Button/button'
import { ConfirmSheet } from '../components/molecules/ConfirmSheet/confirm-sheet'
import { MovieCard } from '../components/organisms/MovieCard/movie-card'
```

No path aliases (`@/`) are configured — use relative paths.

---

## Feature Module Structure

```
src/features/movies/
  movies.types.ts     ← TypeScript interfaces / enums
  movies.schema.ts    ← Zod schemas (infer types from these where possible)
  movies.service.ts   ← async CRUD functions, no React
  movies.queries.ts   ← TanStack Query hooks
  movies.store.ts     ← Zustand store for UI state
```

---

## TanStack Query — Query Hook

```ts
// src/features/movies/movies.queries.ts
import { useQuery } from '@tanstack/react-query'
import { moviesService } from './movies.service'

export const movieKeys = {
  all: ['movies'] as const,
  byStatus: (status: MovieStatus) => ['movies', { status }] as const,
}

export function useMovies() {
  return useQuery({
    queryKey: movieKeys.all,
    queryFn: () => moviesService.getAllMovies(),
  })
}

export function useMoviesByStatus(status: MovieStatus) {
  return useQuery({
    queryKey: movieKeys.byStatus(status),
    queryFn: () => moviesService.getMoviesByStatus(status),
  })
}
```

---

## TanStack Query — Mutation Hook

```ts
export function useCreateMovie() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: CreateMovie) => moviesService.createMovie(data),
    onMutate: async (data) => {
      // Optional: optimistic update
      await queryClient.cancelQueries({ queryKey: movieKeys.all })
      const previous = queryClient.getQueryData(movieKeys.all)
      queryClient.setQueryData(movieKeys.all, (old: Movie[]) => [
        ...old,
        { ...data, id: 'temp', createdAt: new Date().toISOString() },
      ])
      return { previous }
    },
    onError: (_err, _data, context) => {
      // Roll back optimistic update
      queryClient.setQueryData(movieKeys.all, context?.previous)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: movieKeys.all })
    },
  })
}
```

---

## Service Function Pattern

```ts
// src/features/movies/movies.service.ts
import { db } from '@/lib/db'
import type { Movie, CreateMovie } from './movies.types'

export const moviesService = {
  async getAllMovies(): Promise<Movie[]> {
    const rows = await db.select<Movie[]>(
      'SELECT * FROM movies WHERE deleted_at IS NULL ORDER BY title ASC'
    )
    return rows
  },

  async createMovie(data: CreateMovie): Promise<Movie> {
    const id = crypto.randomUUID()
    const now = new Date().toISOString()
    await db.execute(
      `INSERT INTO movies (id, tmdb_id, title, year, status, format, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [id, data.tmdbId, data.title, data.year, data.status, data.format, now, now]
    )
    const [row] = await db.select<Movie[]>('SELECT * FROM movies WHERE id = $1', [id])
    return row
  },
}
```

**Rules:**
- Always filter `WHERE deleted_at IS NULL` on every read query
- Use `$1, $2, ...` positional params — never string interpolation (SQL injection)
- `crypto.randomUUID()` for IDs — no library needed in Tauri WebView
- `updated_at` is set by the DB trigger on UPDATE — only set it explicitly on INSERT

---

## Zustand Store Pattern

```ts
// src/features/movies/movies.store.ts
import { create } from 'zustand'
import type { MovieStatus, MovieFormat } from './movies.types'

interface MoviesStore {
  activeStatus: MovieStatus | null
  activeFormat: MovieFormat | null
  setActiveStatus: (status: MovieStatus | null) => void
  setActiveFormat: (format: MovieFormat | null) => void
}

export const useMoviesStore = create<MoviesStore>((set) => ({
  activeStatus: null,
  activeFormat: null,
  setActiveStatus: (activeStatus) => set({ activeStatus }),
  setActiveFormat: (activeFormat) => set({ activeFormat }),
}))
```

---

## Zod Schema Pattern

```ts
// src/features/movies/movies.schema.ts
import { z } from 'zod'

export const MovieStatusSchema = z.enum(['OWNED', 'WANTED'])
export const MovieFormatSchema = z.enum(['SD', 'HD', '4K', 'CUSTOM'])

export const MovieSchema = z.object({
  id: z.string().uuid(),
  tmdb_id: z.number().int().nullable(),   // null for manual entries
  title: z.string().min(1),
  year: z.number().int().nullable(),
  poster_url: z.string().nullable(),      // local path or TMDB URL
  tmdb_rating: z.number().nullable(),
  personal_rating: z.number().min(1).max(10).nullable(),  // REAL — allows 0.5 steps
  status: MovieStatusSchema,
  format: MovieFormatSchema,
  is_physical: z.number().int().min(0).max(1),
  is_digital: z.number().int().min(0).max(1),
  is_backed_up: z.number().int().min(0).max(1),
  notes: z.string().nullable(),
  deleted_at: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
})

// Infer types from schemas — single source of truth
export type Movie = z.infer<typeof MovieSchema>
```

**Note:** Column names use `snake_case` to match SQLite directly — no camelCase mapping layer.

---

## Soft Delete Pattern

**Delete in service:**
```ts
async deleteMovie(id: string, isOnline: boolean): Promise<void> {
  if (isOnline) {
    // Hard delete immediately — sync will propagate
    await db.execute('DELETE FROM movies WHERE id = $1', [id])
  } else {
    // Soft delete — hidden from UI, queued for sync confirmation
    const now = new Date().toISOString()
    await db.execute(
      'UPDATE movies SET deleted_at = $1 WHERE id = $2',
      [now, id]
    )
  }
}
```

**Every read query:**
```sql
SELECT * FROM movies WHERE deleted_at IS NULL
```

Never omit `WHERE deleted_at IS NULL`. Soft-deleted rows must be invisible to all UI.

---

## Tailwind — Dark-Only App

This app is dark mode only. Do not add `dark:` variants — write dark styles as the base:

```tsx
// Correct — dark-only base styles
<div className="bg-gray-950 text-white">

// Wrong — unnecessary dark: variants
<div className="bg-white dark:bg-gray-950 text-black dark:text-white">
```

---

## Safe Areas (Android)

The app runs edge-to-edge on Android. Every view must respect device safe areas — the camera cutout at the top and the gesture navigation bar at the bottom.

### Rules

- **Top:** Any element that appears at the top of the screen (headers, fixed overlays, toasts) must clear `env(safe-area-inset-top)`. Use inline `style` since Tailwind does not have a built-in safe-area utility:
  ```tsx
  style={{ paddingTop: "env(safe-area-inset-top)" }}
  // or offset from it:
  style={{ top: "calc(env(safe-area-inset-top) + 16px)" }}
  ```

- **Bottom:** Any element at the bottom of the screen (nav bars, bottom sheets, fixed buttons) must clear `env(safe-area-inset-bottom)` **plus an additional 15px** of visual breathing room:
  ```tsx
  style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 15px)" }}
  ```
  The `ConfirmSheet` already does this. Match this pattern for any new bottom-anchored UI.

- **Scrollable content:** Full-screen scroll containers should add bottom padding so the last item isn't hidden behind the gesture bar:
  ```tsx
  <div className="flex-1 overflow-y-auto" style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 15px)" }}>
  ```

### What uses safe areas today

| Component | Edge | Implementation |
|---|---|---|
| `ConfirmSheet` | Bottom | `paddingBottom: calc(env(safe-area-inset-bottom) + 24px)` |
| `Toast` | Top | `top: calc(env(safe-area-inset-top) + 16px)` |

---

## cn() — Conditional Classes

```ts
// src/lib/cn.ts
import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: Parameters<typeof clsx>) {
  return twMerge(clsx(inputs))
}
```

Usage:
```tsx
<button className={cn(
  'px-4 py-2 rounded-lg font-medium',
  isActive && 'bg-blue-600 text-white',
  isDisabled && 'opacity-50 cursor-not-allowed',
  className,  // allow caller to extend
)}>
```

---

## Error Boundaries

Wrap the app root with a React error boundary to catch unexpected JS errors:

```tsx
// src/main.tsx
<ErrorBoundary fallback={<RecoveryScreen />}>
  <App />
</ErrorBoundary>
```

Non-critical errors (TMDB unreachable, image load failure) should be handled inline — non-blocking toasts or silent fallbacks — not via error boundaries.

---

## Calling Tauri Commands from TypeScript

```ts
import { invoke } from '@tauri-apps/api/core'

// Preferred: typed wrapper in src/lib/ or src/features/
export async function getCachedPoster(tmdbId: number): Promise<string | null> {
  return invoke<string | null>('get_cached_poster', { tmdbId })
}
```

**Rule:** Keep `invoke()` calls in `src/lib/` or `src/features/` — not in views or organisms.

**Exception:** Atoms that wrap a single Tauri operation (e.g., `PosterPicker`) may call `invoke()` directly, since they are themselves the typed wrapper for that operation.

---

## TanStack Form Pattern

See `src/views/AddMovieView.tsx` for a full working example. Key points:

```ts
const form = useForm({
  defaultValues: { title: "", year: String(currentYear), ... },
  onSubmit: async ({ value }) => {
    const payload = SomeSchema.parse({ ...value }); // final Zod parse
    await mutateAsync(payload);
    navigate({ to: "/" });
  },
});
```

- Field validators use Zod `.safeParse()` — no zod-form-adapter
- Use `onBlur` validators to avoid premature error messages
- Use `form.Subscribe` to read `isSubmitting` for disabling buttons
- `form.handleSubmit()` can be called from any button (header Save + bottom Submit)
