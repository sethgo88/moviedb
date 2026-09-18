import { z } from "zod";
import {
	MovieFormatSchema,
	MovieStatusSchema,
	MovieTypeSchema,
} from "../movies/movies.schema";

// Supabase returns proper native types — no sentinel value handling needed.
export const SupabaseMovieRecordSchema = z.object({
	id: z.string().uuid(),
	tmdb_id: z.number().int().nullable(),
	title: z.string(),
	year: z.number().int().nullable(),
	poster_url: z.string().nullable(),
	tmdb_rating: z.number().nullable(),
	personal_rating: z.number().nullable(),
	status: MovieStatusSchema,
	format: MovieFormatSchema,
	is_physical: z.boolean(),
	is_digital: z.boolean(),
	is_backed_up: z.boolean(),
	notes: z.string().nullable(),
	deleted_at: z.string().nullable(),
	created_at: z.string(),
	updated_at: z.string(),
	// TV show fields — catch for any rows missing these columns
	type: MovieTypeSchema.catch("MOVIE"),
	show_id: z.string().nullable(),
	season_number: z.number().int().nullable(),
});

const SyncedMovieSchema = z.object({
	id: z.string(),
	title: z.string(),
});

export const SyncConflictSchema = z.object({
	id: z.string(),
	title: z.string(),
	local: SupabaseMovieRecordSchema,
	remote: SupabaseMovieRecordSchema,
});

export const SyncResultSchema = z.object({
	pushedMovies: z.array(SyncedMovieSchema),
	pulledMovies: z.array(SyncedMovieSchema),
	deletedMovies: z.array(SyncedMovieSchema),
	dedupedMovies: z.array(SyncedMovieSchema),
	conflicts: z.array(SyncConflictSchema),
	errors: z.array(z.string()),
});
