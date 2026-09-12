import { invoke } from "@tauri-apps/api/core";
import { getDb } from "../../lib/db";
import {
	TmdbMovieDetailsSchema,
	TmdbSearchResponseSchema,
	TmdbSeasonDetailsSchema,
	TmdbShowDetailsSchema,
	TmdbTvSearchResponseSchema,
} from "./tmdb.schema";
import type {
	TmdbSearchResult,
	TmdbSeasonDetails,
	TmdbShowDetails,
	TmdbTvSearchResult,
} from "./tmdb.types";

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

export async function searchMovieByTitleYear(
	title: string,
	year: number,
): Promise<TmdbSearchResult[]> {
	const url = `${TMDB_BASE}/search/movie?query=${encodeURIComponent(title)}&primary_release_year=${year}&api_key=${TMDB_API_KEY}&language=en-US&page=1`;
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
 * Fetch movie details from TMDB to get the poster_path.
 * Returns null if the movie has no poster or the request fails.
 */
async function fetchTmdbPosterPath(tmdbId: number): Promise<string | null> {
	const url = `${TMDB_BASE}/movie/${tmdbId}?api_key=${TMDB_API_KEY}`;
	const res = await fetch(url);
	if (!res.ok) return null;
	const data = TmdbMovieDetailsSchema.parse(await res.json());
	return data.poster_path;
}

/**
 * Find all movies missing a local poster that have a tmdb_id, and cache
 * their posters from TMDB. Handles two cases:
 *   1. poster_url is a TMDB URL (e.g. after a sync pull) — cache directly.
 *   2. poster_url is null — fetch movie details from TMDB to get poster_path,
 *      then cache. This covers movies whose data URLs were stripped to null
 *      before pushing to PocketBase.
 * Returns the count of successfully cached posters.
 */
export async function refreshUncachedPosters(): Promise<number> {
	const db = await getDb();
	const rows = await db.select<
		{ id: string; tmdb_id: number; poster_url: string | null }[]
	>(
		`SELECT id, tmdb_id, poster_url FROM movies
		 WHERE deleted_at IS NULL
		   AND tmdb_id IS NOT NULL
		   AND (poster_url IS NULL OR poster_url LIKE 'https://image.tmdb.org%')`,
	);

	let count = 0;
	for (const row of rows) {
		try {
			let dataUrl: string;
			if (row.poster_url) {
				dataUrl = await cachePosterFromUrl(row.tmdb_id, row.poster_url);
			} else {
				const posterPath = await fetchTmdbPosterPath(row.tmdb_id);
				if (!posterPath) continue;
				dataUrl = await fetchAndCachePoster(row.tmdb_id, posterPath);
			}
			await db.execute("UPDATE movies SET poster_url = $1 WHERE id = $2", [
				dataUrl,
				row.id,
			]);
			count++;
		} catch {
			// silent fail — skip this movie and continue with the rest
		}
	}
	return count;
}

export async function searchShows(
	query: string,
): Promise<TmdbTvSearchResult[]> {
	const url = `${TMDB_BASE}/search/tv?query=${encodeURIComponent(query)}&api_key=${TMDB_API_KEY}&language=en-US&page=1`;
	const res = await fetch(url);
	if (!res.ok) throw new Error(`TMDB error: ${res.status}`);
	const data = TmdbTvSearchResponseSchema.parse(await res.json());
	return data.results;
}

export async function fetchShowDetails(
	tmdbShowId: number,
): Promise<TmdbShowDetails> {
	const url = `${TMDB_BASE}/tv/${tmdbShowId}?api_key=${TMDB_API_KEY}`;
	const res = await fetch(url);
	if (!res.ok) throw new Error(`TMDB error: ${res.status}`);
	return TmdbShowDetailsSchema.parse(await res.json());
}

/**
 * Fetch season details. Returns the season poster_path if available,
 * falling back to the show poster_path if the season has none.
 */
export async function fetchSeasonDetails(
	tmdbShowId: number,
	seasonNumber: number,
): Promise<TmdbSeasonDetails> {
	const [seasonRes, showRes] = await Promise.all([
		fetch(
			`${TMDB_BASE}/tv/${tmdbShowId}/season/${seasonNumber}?api_key=${TMDB_API_KEY}`,
		),
		fetch(`${TMDB_BASE}/tv/${tmdbShowId}?api_key=${TMDB_API_KEY}`),
	]);
	if (!seasonRes.ok) throw new Error(`TMDB error: ${seasonRes.status}`);
	const season = TmdbSeasonDetailsSchema.parse(await seasonRes.json());
	if (season.poster_path) return season;
	if (!showRes.ok) return season;
	const show = TmdbShowDetailsSchema.parse(await showRes.json());
	return { ...season, poster_path: show.poster_path };
}

/**
 * For every movie/show/season with a tmdb_id, fetch fresh TMDB metadata and
 * update year, tmdb_rating, and poster_url (if not already locally cached).
 * Returns the count of successfully updated records.
 */
export async function refreshTmdbData(): Promise<number> {
	const db = await getDb();
	const rows = await db.select<
		{
			id: string;
			tmdb_id: number;
			type: string;
			poster_url: string | null;
			season_number: number | null;
			show_tmdb_id: number | null;
		}[]
	>(
		`SELECT m.id, m.tmdb_id, m.type, m.poster_url, m.season_number,
		        s.tmdb_id AS show_tmdb_id
		 FROM movies m
		 LEFT JOIN movies s ON s.id = m.show_id
		 WHERE m.deleted_at IS NULL AND m.tmdb_id IS NOT NULL`,
	);

	let count = 0;
	for (const row of rows) {
		try {
			let year: number | null = null;
			let tmdbRating: number | null = null;
			let posterPath: string | null = null;

			if (row.type === "MOVIE") {
				const url = `${TMDB_BASE}/movie/${row.tmdb_id}?api_key=${TMDB_API_KEY}`;
				const res = await fetch(url);
				if (!res.ok) continue;
				const data = TmdbMovieDetailsSchema.parse(await res.json());
				year = data.release_date
					? parseInt(data.release_date.slice(0, 4), 10) || null
					: null;
				tmdbRating = data.vote_average > 0 ? data.vote_average : null;
				posterPath = data.poster_path;
			} else if (row.type === "TV_SHOW") {
				const url = `${TMDB_BASE}/tv/${row.tmdb_id}?api_key=${TMDB_API_KEY}`;
				const res = await fetch(url);
				if (!res.ok) continue;
				const data = TmdbShowDetailsSchema.parse(await res.json());
				year = data.first_air_date
					? parseInt(data.first_air_date.slice(0, 4), 10) || null
					: null;
				tmdbRating = data.vote_average > 0 ? data.vote_average : null;
				posterPath = data.poster_path;
			} else if (
				row.type === "TV_SEASON" &&
				row.show_tmdb_id != null &&
				row.season_number != null
			) {
				const [seasonRes, showRes] = await Promise.all([
					fetch(
						`${TMDB_BASE}/tv/${row.show_tmdb_id}/season/${row.season_number}?api_key=${TMDB_API_KEY}`,
					),
					fetch(`${TMDB_BASE}/tv/${row.show_tmdb_id}?api_key=${TMDB_API_KEY}`),
				]);
				if (!seasonRes.ok) continue;
				const season = TmdbSeasonDetailsSchema.parse(await seasonRes.json());
				year = season.air_date
					? parseInt(season.air_date.slice(0, 4), 10) || null
					: null;
				posterPath = season.poster_path;
				if (showRes.ok) {
					const show = TmdbShowDetailsSchema.parse(await showRes.json());
					if (!posterPath) posterPath = show.poster_path;
					tmdbRating = show.vote_average > 0 ? show.vote_average : null;
				}
			} else {
				continue;
			}

			// Only update poster if not already a locally cached data URL
			let posterUrl = row.poster_url;
			if (
				posterPath &&
				(!posterUrl || posterUrl.startsWith("https://image.tmdb.org"))
			) {
				try {
					posterUrl = await fetchAndCachePoster(row.tmdb_id, posterPath);
				} catch {
					// keep existing
				}
			}

			await db.execute(
				`UPDATE movies SET year = $1, tmdb_rating = $2, poster_url = $3 WHERE id = $4`,
				[year, tmdbRating, posterUrl, row.id],
			);
			count++;
		} catch {
			// silent fail — skip this entry and continue
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
