import { invoke } from "@tauri-apps/api/core";
import { z } from "zod";
import { getDb } from "../../lib/db";
import { TMDB_POSTER_BASE } from "../tmdb/tmdb.service";
import {
	MovieSchema,
	NewMovieSchema,
	UpdateMovieSchema,
} from "./movies.schema";
import type { Movie, NewMovie, UpdateMovie } from "./movies.types";

export async function getAllMovies(): Promise<Movie[]> {
	const db = await getDb();
	const rows = await db.select("SELECT * FROM movies WHERE deleted_at IS NULL");
	return z.array(MovieSchema).parse(rows);
}

export async function getMovieById(id: string): Promise<Movie | null> {
	const db = await getDb();
	const rows = await db.select(
		"SELECT * FROM movies WHERE id = $1 AND deleted_at IS NULL",
		[id],
	);
	const results = z.array(MovieSchema).parse(rows);
	return results[0] ?? null;
}

export async function createMovie(data: NewMovie): Promise<Movie> {
	const validated = NewMovieSchema.parse(data);
	const db = await getDb();
	const id = crypto.randomUUID();
	const now = new Date().toISOString();

	await db.execute(
		`INSERT INTO movies (
      id, tmdb_id, title, year, poster_url, tmdb_rating, personal_rating,
      status, format, is_physical, is_digital, is_backed_up, notes,
      deleted_at, created_at, updated_at,
      type, show_id, season_number, tmdb_poster_path
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7,
      $8, $9, $10, $11, $12, $13,
      NULL, $14, $14,
      $15, $16, $17, $18
    )`,
		[
			id,
			validated.tmdb_id,
			validated.title,
			validated.year ?? null,
			validated.poster_url ?? null,
			validated.tmdb_rating ?? null,
			validated.personal_rating ?? null,
			validated.status,
			validated.format,
			validated.is_physical,
			validated.is_digital,
			validated.is_backed_up,
			validated.notes ?? null,
			now,
			validated.type,
			validated.show_id ?? null,
			validated.season_number ?? null,
			validated.tmdb_poster_path ?? null,
		],
	);

	const created = await getMovieById(id);
	if (created === null)
		throw new Error(`Failed to retrieve movie after insert: ${id}`);
	return created;
}

export async function getMovieByTmdbId(tmdbId: number): Promise<Movie | null> {
	const db = await getDb();
	const rows = await db.select(
		"SELECT * FROM movies WHERE tmdb_id = $1 AND type = 'MOVIE' AND deleted_at IS NULL LIMIT 1",
		[tmdbId],
	);
	const results = z.array(MovieSchema).parse(rows);
	return results[0] ?? null;
}

export async function getShowByTmdbId(tmdbId: number): Promise<Movie | null> {
	const db = await getDb();
	const rows = await db.select(
		"SELECT * FROM movies WHERE tmdb_id = $1 AND type = 'TV_SHOW' AND deleted_at IS NULL LIMIT 1",
		[tmdbId],
	);
	const results = z.array(MovieSchema).parse(rows);
	return results[0] ?? null;
}

const ALLOWED_UPDATE_COLUMNS = new Set([
	"tmdb_id",
	"title",
	"year",
	"poster_url",
	"tmdb_rating",
	"personal_rating",
	"status",
	"format",
	"is_physical",
	"is_digital",
	"is_backed_up",
	"notes",
	"type",
	"show_id",
	"season_number",
]);

export async function updateMovie(
	id: string,
	data: UpdateMovie,
): Promise<Movie> {
	const validated = UpdateMovieSchema.parse(data);
	const entries = Object.entries(validated).filter(([key, v]) => {
		if (v === undefined) return false;
		if (!ALLOWED_UPDATE_COLUMNS.has(key))
			throw new Error(`Attempted to update disallowed column: ${key}`);
		return true;
	});
	if (entries.length === 0) {
		const existing = await getMovieById(id);
		if (existing === null) throw new Error(`Movie not found: ${id}`);
		return existing;
	}

	const db = await getDb();
	const setClauses = entries.map(([key], i) => `${key} = $${i + 1}`).join(", ");
	const values = entries.map(([, v]) => v ?? null);

	await db.execute(
		`UPDATE movies SET ${setClauses} WHERE id = $${entries.length + 1}`,
		[...values, id],
	);

	const updated = await getMovieById(id);
	if (updated === null) throw new Error(`Movie not found after update: ${id}`);
	return updated;
}

export async function softDeleteMovie(id: string): Promise<void> {
	const db = await getDb();
	const now = new Date().toISOString();
	await db.execute("UPDATE movies SET deleted_at = $1 WHERE id = $2", [
		now,
		id,
	]);
}

export async function hardDeleteMovie(id: string): Promise<void> {
	const db = await getDb();
	await db.execute("DELETE FROM movies WHERE id = $1", [id]);
}

export async function checkMovieDuplicate(tmdbId: number): Promise<boolean> {
	const db = await getDb();
	const rows = await db.select<{ count: number }[]>(
		"SELECT COUNT(*) as count FROM movies WHERE tmdb_id = $1 AND type = 'MOVIE' AND deleted_at IS NULL",
		[tmdbId],
	);
	return (rows[0]?.count ?? 0) > 0;
}

export async function checkSeasonDuplicate(
	tmdbId: number,
	seasonNumber: number,
): Promise<boolean> {
	const db = await getDb();
	const rows = await db.select<{ count: number }[]>(
		"SELECT COUNT(*) as count FROM movies WHERE tmdb_id = $1 AND season_number = $2 AND type = 'TV_SEASON' AND deleted_at IS NULL",
		[tmdbId, seasonNumber],
	);
	return (rows[0]?.count ?? 0) > 0;
}

export async function checkTitleYearSimilar(
	title: string,
	year: number | null,
): Promise<boolean> {
	const db = await getDb();
	const rows = await db.select<{ count: number }[]>(
		"SELECT COUNT(*) as count FROM movies WHERE LOWER(title) = LOWER($1) AND (year = $2 OR ($2 IS NULL AND year IS NULL)) AND deleted_at IS NULL",
		[title, year],
	);
	return (rows[0]?.count ?? 0) > 0;
}

type PublicMovieRow = {
	id: string;
	title: string;
	year: number | null;
	tmdb_id: number | null;
	tmdb_rating: number | null;
	tmdb_poster_path: string | null;
	status: string;
	format: string;
	is_physical: number;
	is_digital: number;
	type: string;
	season_number: number | null;
	// show_id included so the public site can group TV seasons by show
	show_id: string | null;
};

type PublicMovieOut = Omit<PublicMovieRow, "is_physical" | "is_digital"> & {
	is_physical: boolean;
	is_digital: boolean;
	poster_url: string | null;
};

function toBase64(str: string): string {
	const bytes = new TextEncoder().encode(str);
	let binary = "";
	for (const byte of bytes) {
		binary += String.fromCharCode(byte);
	}
	return btoa(binary);
}

export async function publishToWeb(): Promise<void> {
	const pat = import.meta.env.VITE_GITHUB_PAT || undefined;
	if (!pat) throw new Error("VITE_GITHUB_PAT is not set");

	const db = await getDb();
	const rows = await db.select<PublicMovieRow[]>(
		`SELECT id, title, year, tmdb_id, tmdb_rating, tmdb_poster_path,
		 status, format, is_physical, is_digital, type, season_number, show_id
		 FROM movies WHERE deleted_at IS NULL ORDER BY title`,
	);

	const movies: PublicMovieOut[] = rows.map((r) => ({
		...r,
		is_physical: r.is_physical === 1,
		is_digital: r.is_digital === 1,
		poster_url: r.tmdb_poster_path
			? `${TMDB_POSTER_BASE}${r.tmdb_poster_path}`
			: null,
	}));

	const content = JSON.stringify(movies, null, 2);
	const apiUrl =
		"https://api.github.com/repos/sethgo88/moviedb-view/contents/public/movies.json";
	const headers = {
		Authorization: `Bearer ${pat}`,
		Accept: "application/vnd.github+json",
		"X-GitHub-Api-Version": "2022-11-28",
	};

	const getRes = await fetch(apiUrl, { headers });
	let sha: string | undefined;
	if (getRes.ok) {
		const data = (await getRes.json()) as { sha: string; [key: string]: unknown };
		sha = data.sha;
	} else if (getRes.status !== 404) {
		const errText = await getRes.text();
		throw new Error(`GitHub API error fetching SHA (${getRes.status}): ${errText}`);
	}
	// 404 means the file doesn't exist yet; proceed with a create (no sha needed)

	const putRes = await fetch(apiUrl, {
		method: "PUT",
		headers: { ...headers, "Content-Type": "application/json" },
		body: JSON.stringify({
			message: "chore: update public movies.json",
			content: toBase64(content),
			...(sha ? { sha } : {}),
		}),
	});

	if (!putRes.ok) {
		const err = await putRes.text();
		throw new Error(`GitHub API error ${putRes.status}: ${err}`);
	}
}

export async function exportCollectionAsJson(): Promise<string> {
	const movies = await getAllMovies();
	const content = JSON.stringify(movies, null, 2);
	const today = new Date().toISOString().slice(0, 10);
	const filename = `moviedb-export-${today}.json`;
	const path = await invoke<string>("write_to_downloads", { filename, content });
	return path;
}

export async function exportCollectionAsCsv(): Promise<string> {
	const movies = await getAllMovies();
	const header = "title,year,format,status,tmdb_rating,personal_rating";
	const rows = movies.map((m) => {
		const cols = [
			`"${m.title.replace(/"/g, '""')}"`,
			m.year ?? "",
			m.format,
			m.status,
			m.tmdb_rating ?? "",
			m.personal_rating ?? "",
		];
		return cols.join(",");
	});
	const content = [header, ...rows].join("\n");
	const today = new Date().toISOString().slice(0, 10);
	const filename = `moviedb-export-${today}.csv`;
	const path = await invoke<string>("write_to_downloads", { filename, content });
	return path;
}
