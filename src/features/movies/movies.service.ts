import { z } from "zod";
import { getDb } from "../../lib/db";
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
      type, show_id, season_number
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7,
      $8, $9, $10, $11, $12, $13,
      NULL, $14, $14,
      $15, $16, $17
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
		],
	);

	const created = await getMovieById(id);
	if (created === null)
		throw new Error(`Failed to retrieve movie after insert: ${id}`);
	return created;
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
