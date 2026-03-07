# Skill: check

Run all quality checks and fix any issues found.

## What to do

Run these checks in order. Fix all issues before moving on to the next check.

### 1. TypeScript type check
```bash
pnpm tsc --noEmit
```
Fix all type errors. Do not use `any` or `@ts-ignore` to silence errors — fix the root cause.

### 2. Biome lint
```bash
pnpm lint
```
Fix all lint warnings and errors. Biome is the only linter — do not add ESLint rules.

### 3. Biome format
```bash
pnpm format
```
This auto-applies formatting. No manual review needed after running this.

### 4. Build check (optional — run if TypeScript check passed)
```bash
pnpm build
```
Catches bundler errors that `tsc --noEmit` won't catch (e.g., missing imports, circular deps).

## Common issues and fixes

**Unused variable errors (`noUnusedLocals`, `noUnusedParameters`)**
Remove unused vars, or prefix with `_` if the param is required by a callback signature.

**Implicit `any` from untyped function return**
Add explicit return type annotation or ensure the return value is typed.

**Zod schema / TypeScript type mismatch**
If you changed a Zod schema, re-run `z.infer<typeof Schema>` to regenerate the type. Don't maintain parallel type definitions.

**TanStack Query stale queryKey**
After adding a filter param to a query, include it in the `queryKey` array so cache entries are keyed correctly.

## Zero-warning policy
All checks must pass clean before the work is considered done.
