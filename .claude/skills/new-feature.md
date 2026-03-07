# Skill: new-feature

Scaffold a new feature module under `src/features/<name>/`.

## What to do

Ask the user for the feature name if not provided in the command (e.g., `/new-feature ratings`).

Create the following files under `src/features/<name>/`:

### `<name>.types.ts`
Define TypeScript interfaces and enums for the feature. Use `const` objects or Zod enums — not the TypeScript `enum` keyword.

### `<name>.schema.ts`
Define Zod schemas. Infer TypeScript types from schemas where possible:
```ts
export const MovieSchema = z.object({ ... })
export type Movie = z.infer<typeof MovieSchema>
```

### `<name>.service.ts`
Pure async functions — no React, no hooks. Imports from `src/lib/db.ts` for SQLite access.
Functions return typed results; throw on failure so TanStack Query can catch.

### `<name>.queries.ts`
TanStack Query hooks that wrap service calls:
- `useXxx()` → `useQuery({ queryKey: ['xxx'], queryFn: ... })`
- `useCreateXxx()` → `useMutation({ mutationFn: ..., onSuccess: () => queryClient.invalidateQueries(...) })`

### `<name>.store.ts`
Zustand store for UI state (filters, selection, loading flags).
Do NOT store server data here — that belongs in TanStack Query cache.
Use optimistic updates for mutations: update store immediately, roll back on error.

## Rules
- Never put UI (JSX, React components) in `features/` — UI goes in `components/` or `views/`
- All async data flows through TanStack Query — no raw `useEffect` fetching
- All external data validated with Zod schemas at the boundary
- `updated_at` is always an ISO 8601 string; never use `Date` objects in DB layer
- UUIDs generated with `crypto.randomUUID()` — no library needed in Tauri WebView
