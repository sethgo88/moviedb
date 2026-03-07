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

Every component, even atoms, lives in its own folder:

```
src/components/atoms/Button/
  index.ts          ← re-export barrel
  Button.tsx        ← implementation
  Button.test.tsx   ← optional, co-located
```

`index.ts` content:
```ts
export { Button } from './Button'
```

Import consumers use the folder path:
```ts
import { Button } from '@/components/atoms/Button'
```

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
export const MovieFormatSchema = z.enum(['HD', '4K'])

export const MovieSchema = z.object({
  id: z.string().uuid(),
  tmdbId: z.number().int(),
  title: z.string().min(1),
  year: z.number().int().min(1888),
  posterUrl: z.string().url().nullable(),
  tmdbRating: z.number().nullable(),
  personalRating: z.number().int().min(1).max(10).nullable(),
  status: MovieStatusSchema,
  format: MovieFormatSchema,
  isPhysical: z.boolean(),
  isDigital: z.boolean(),
  isBackedUp: z.boolean(),
  notes: z.string().nullable(),
  deletedAt: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
})

export const CreateMovieSchema = MovieSchema.omit({
  id: true,
  deletedAt: true,
  createdAt: true,
  updatedAt: true,
})

// Infer types from schemas — single source of truth
export type Movie = z.infer<typeof MovieSchema>
export type CreateMovie = z.infer<typeof CreateMovieSchema>
```

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

## Tailwind Dark Mode Pattern

Always include both light and dark variants for any color:

```tsx
// Correct
<div className="bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100">

// Wrong — no dark variant
<div className="bg-white text-zinc-900">
```

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

// Typed wrapper — always wrap invoke() calls, never use raw invoke in components
export async function getCachedPoster(tmdbId: number): Promise<string | null> {
  return invoke<string | null>('get_cached_poster', { tmdbId })
}
```

Keep all `invoke()` calls in `src/lib/` or `src/features/` — never call `invoke()` directly inside a component.
