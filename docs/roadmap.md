# Movie Collection App — Roadmap

## Code Cleanup (no new features)

Small, safe improvements to the existing codebase.

- [ ] Delete `src/lib/assetUrl.ts` — `localFileToAssetUrl` is never imported anywhere
- [ ] Delete `src/components/atoms/Input/input.tsx` — unused; all forms use raw `<input>` elements
- [ ] Remove `selectedMovieId` / `setSelectedMovieId` from `movies.store.ts` — never read; navigation uses URL params
- [ ] Strip ~9 debug `console.log` calls from `poster-picker.tsx` (leftover from Android debugging)
- [ ] Replace `submitLabel === "Save"` string check in `MovieForm` with an explicit `isEditMode` boolean prop
- [ ] Migrate `SyncView` `LoginForm` manual `isLoading`/`error` state to `useMutation`
- [ ] Fix `architecture.md`: remove `date.ts` reference, update `save_custom_poster` description (stores data URL, not file path)
- [ ] Fix `database.md`: TMDB posters section still says "not yet implemented"; TTL/LRU described was never built

---

## Feature Backlog

### High priority

| Feature | Description | Complexity |
|---|---|---|
| Genre & director fields | TMDB already returns these — store and surface them in the schema, form, and filter panel | Low |
| Watch history / log | Add `watched_at` date or separate `watch_log` table. Track last-watched, watch count, rewatch flag | Medium |
| Statistics view | Totals, format breakdown, by decade, average rating, top genres, total runtime — all from SQLite | Medium |
| Import / export | CSV or JSON export of full collection. Backup independent of PocketBase. Letterboxd/IMDb import | Medium |

### Medium priority

| Feature | Description | Complexity |
|---|---|---|
| Barcode scanner | Scan DVD/Blu-ray barcode on Android → TMDB lookup. Zero-friction physical cataloguing | Medium |
| Batch edit | Multi-select to set status, format, or delete in bulk | Medium |
| Duplicate detection | Warn when adding a movie already in the collection | Low |
| Lend tracker | Mark a movie as lent out to a named person with a date; surface overdue loans | Medium |
| Streaming availability | TMDB "watch providers" endpoint — show Netflix/etc. availability for your country | Low |

### Lower priority / nice to have

| Feature | Description | Complexity |
|---|---|---|
| Lists / collections | Named lists beyond OWNED/WANTED (e.g. Favourites, Watchlist, Lent out) | Medium |
| Friends / sharing | Read-only shareable "want list" via a PocketBase public view URL | Medium |
| Movie recommendations | TMDB "similar movies" endpoint — "if you own X, you might like Y" | Low |
| Cloud backup | Export SQLite DB to Google Drive / device cloud storage | Medium |
| Collection value estimator | Price lookup for physical media (eBay/Discogs) | High |
| Dark/light theme toggle | App is dark-only today; expose a theme preference | Low |
| Widget / home screen shortcut | Android quick-add from notification shade | High |
