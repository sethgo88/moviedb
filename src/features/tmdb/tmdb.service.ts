import { invoke } from "@tauri-apps/api/core";
import { getDb } from "../../lib/db";
import { TmdbSearchResponseSchema } from "./tmdb.schema";
import type { TmdbSearchResult } from "./tmdb.types";

const TMDB_API_KEY = "c31792e2421ac6f25c2a57a506e23d8a";
const TMDB_BASE = "https://api.themoviedb.org/3";
export const TMDB_POSTER_BASE = "https://image.tmdb.org/t/p/w185";

export async function searchMovies(query: string): Promise<TmdbSearchResult[]> {
	const url = `${TMDB_BASE}/search/movie?query=${encodeURIComponent(query)}&api_key=${TMDB_API_KEY}&language=en-US&page=1`;
	const res = await fetch(url);
	if (!res.ok) throw new Error(`TMDB error: ${res.status}`);
	const data = TmdbSearchResponseSchema.parse(await res.json());
	return data.results;
}

/**
 * Fetch and cache a TMDB poster via Rust (reqwest — no CORS restriction).
 * Checks the local poster-cache first; downloads only if not cached.
 * Returns a JPEG data URL suitable for storage in poster_url.
 */
export async function fetchAndCachePoster(
	tmdbId: number,
	posterPath: string,
): Promise<string> {
	const url = `${TMDB_POSTER_BASE}${posterPath}`;

	// Check local cache first
	const cached = await invoke<string | null>("get_cached_poster", { tmdbId });
	if (cached) return cached;

	// Download via Rust and cache
	return invoke<string>("cache_poster", { tmdbId, url });
}

/**
 * Cache a poster from a full TMDB URL (e.g. as stored after a PocketBase pull).
 * Checks local cache first; downloads via Rust reqwest only if not cached.
 */
export async function cachePosterFromUrl(
	tmdbId: number,
	fullUrl: string,
): Promise<string> {
	const cached = await invoke<string | null>("get_cached_poster", { tmdbId });
	if (cached) return cached;
	return invoke<string>("cache_poster", { tmdbId, url: fullUrl });
}

/**
 * Find all movies with an uncached TMDB poster URL (poster_url starts with
 * https://image.tmdb.org) and cache them locally via Rust.
 * Returns the count of successfully cached posters.
 */
export async function refreshUncachedPosters(): Promise<number> {
	const db = await getDb();
	const rows = await db.select<
		{ id: string; tmdb_id: number; poster_url: string }[]
	>(
		`SELECT id, tmdb_id, poster_url FROM movies
		 WHERE deleted_at IS NULL
		   AND tmdb_id IS NOT NULL
		   AND poster_url LIKE 'https://image.tmdb.org%'`,
	);

	let count = 0;
	for (const row of rows) {
		try {
			const dataUrl = await cachePosterFromUrl(row.tmdb_id, row.poster_url);
			await db.execute("UPDATE movies SET poster_url = $1 WHERE id = $2", [
				dataUrl,
				row.id,
			]);
			count++;
		} catch {
			// silent fail — leave the TMDB URL in place if caching fails
		}
	}
	return count;
}

export async function clearPosterCache(): Promise<void> {
	return invoke("clear_poster_cache");
}

export async function getPosterCacheSize(): Promise<number> {
	return invoke<number>("get_poster_cache_size");
}
