# Skill: new-component

Scaffold a new UI component at the correct atomic design level.

## What to do

Ask the user for:
1. Component name (e.g., `MovieCard`)
2. Atomic level if not obvious — atom / molecule / organism / template

Determine level by these rules:
- **atom** — smallest indivisible unit, no sub-components from this project (Button, Badge, Input, Spinner, Poster, Icon)
- **molecule** — combines 2+ atoms into a simple cohesive unit (SearchBar, FormField, SyncStatus, MovieBadgeGroup)
- **organism** — complex, self-contained section that may have its own data/state (MovieCard, MovieGrid, MovieForm, NavBar, FilterPanel)
- **template** — page layout shell with no real data, just slots/children (AppLayout, ModalLayout)

## File structure

Create a folder: `src/components/<level>/<ComponentName>/`

Files inside:
- `index.tsx` — implementation file (export the component directly from here — no separate barrel)
- `<ComponentName>.test.tsx` — optional, add only if the user asks or if logic is non-trivial

## Component template

```tsx
import { cn } from "../../../lib/cn";

interface <ComponentName>Props {
  // props here
  className?: string;
}

export function <ComponentName>({ className, ...props }: <ComponentName>Props) {
  return (
    <div className={cn("...", className)}>
      {/* ... */}
    </div>
  );
}
```

## Rules
- Tailwind only — no inline styles, no CSS modules
- App is dark-only — write dark styles as the base, no `dark:` variants needed
- Touch targets minimum 48x48 logical pixels for all interactive elements (Android guideline)
- No data fetching inside atoms or molecules — pass data as props
- Organisms may use TanStack Query hooks or Zustand store selectors
- Views (in `src/views/`) are the only place that should compose organisms with real page-level data
- Implementation goes directly in `index.tsx` — no separate barrel file
