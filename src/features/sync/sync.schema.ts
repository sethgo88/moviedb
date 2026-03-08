import { z } from "zod";
import { MovieFormatSchema, MovieStatusSchema } from "../movies/movies.schema";

export const PbMovieRecordSchema = z.object({
	// PocketBase metadata
	id: z.string(),
	collectionId: z.string(),
	collectionName: z.string(),
	created: z.string(),
	updated: z.string(),
	// Our fields
	local_id: z.string().uuid(),
	tmdb_id: z.number().int().nullable(),
	title: z.string(),
	year: z.number().int().nullable(),
	poster_url: z.string().nullable(),
	tmdb_rating: z.number().nullable(),
	personal_rating: z.number().min(1).max(10).nullable(),
	status: MovieStatusSchema,
	format: MovieFormatSchema,
	is_physical: z.boolean(),
	is_digital: z.boolean(),
	is_backed_up: z.boolean(),
	notes: z.string().nullable(),
	deleted_at: z.string().nullable(),
	created_at: z.string(),
	updated_at: z.string(),
});

export const SyncResultSchema = z.object({
	pushed: z.number().int(),
	pulled: z.number().int(),
	errors: z.array(z.string()),
});
