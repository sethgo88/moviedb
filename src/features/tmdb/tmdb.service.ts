import { invoke } from "@tauri-apps/api/core";
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

export async function clearPosterCache(): Promise<void> {
	return invoke("clear_poster_cache");
}

export async function getPosterCacheSize(): Promise<number> {
	return invoke<number>("get_poster_cache_size");
}
