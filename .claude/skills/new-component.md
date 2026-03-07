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
- `index.ts` — re-exports the component: `export { ComponentName } from './ComponentName'`
- `<ComponentName>.tsx` — the component

Optionally add:
- `<ComponentName>.test.tsx` — if the user asks for a test, or if the component has non-trivial logic

## Component template

```tsx
import type { FC } from 'react'

interface <ComponentName>Props {
  // props here
}

export const <ComponentName>: FC<<ComponentName>Props> = ({ ... }) => {
  return (
    <div>
      {/* ... */}
    </div>
  )
}
```

## Rules
- Tailwind only — no inline styles, no CSS modules
- Use `dark:` variants for all color classes — dark mode is required throughout
- Touch targets minimum 48x48 logical pixels for all interactive elements (Android guideline)
- No data fetching inside atoms or molecules — pass data as props
- Organisms may use TanStack Query hooks or Zustand store selectors
- Views (in `src/views/`) are the only place that should compose organisms with real page-level data
- Export everything through the `index.ts` barrel — consumers import from the folder, not the file
