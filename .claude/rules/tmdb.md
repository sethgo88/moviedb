---
paths:
  - "src/features/tmdb/**"
---

## TMDB Integration Rules

- **Poster URL format** — `https://image.tmdb.org/t/p/w185/<poster_path>`. Always use `w185` size. Never construct URLs with string interpolation — use the helper in `tmdb.service.ts`.
- **Null poster_path** — not all movies have posters. Always handle `poster_path: null` — fall back to a placeholder, never crash.
- **Search vs. detail** — search endpoint returns summary data only. Always fetch the detail endpoint (`/movie/<tmdb_id>`) to get full metadata before saving.
- **Store tmdb_id** — save `tmdb_id` on the movie record so metadata can be re-fetched without another search. Never rely on title matching.
- **No API key in source** — TMDB API key lives in Tauri secure store. Never hardcode or commit it.
