import { z } from "zod";
import {
	MovieFormatSchema,
	MovieStatusSchema,
	MovieTypeSchema,
} from "../movies/movies.schema";

// PocketBase returns 0 for unset number fields and "" for unset string fields
// instead of null. These helpers normalise those sentinel values to null.
const pbNullableInt = z
	.number()
	.int()
	.nullable()
	.optional()
	.transform((v) => (v == null || v === 0 ? null : v));

const pbNullableNumber = z
	.number()
	.nullable()
	.optional()
	.transform((v) => (v == null || v === 0 ? null : v));

const pbNullableString = z
	.string()
	.nullable()
	.optional()
	.transform((v) => (v === "" || v == null ? null : v));

export const PbMovieRecordSchema = z.object({
	// PocketBase metadata
	id: z.string(),
	collectionId: z.string(),
	collectionName: z.string(),
	created: z.string(),
	updated: z.string(),
	// Our fields
	local_id: z.string().uuid(),
	tmdb_id: pbNullableInt,
	title: z.string(),
	year: pbNullableInt,
	poster_url: pbNullableString,
	tmdb_rating: pbNullableNumber,
	personal_rating: pbNullableNumber,
	status: MovieStatusSchema,
	format: MovieFormatSchema,
	is_physical: z.boolean(),
	is_digital: z.boolean(),
	is_backed_up: z.boolean(),
	notes: pbNullableString,
	deleted_at: pbNullableString,
	created_at: z.string(),
	updated_at: z
		.string()
		.optional()
		.transform((v) => v ?? ""),
	// TV show fields — optional with safe fallbacks for old PocketBase records
	type: MovieTypeSchema.catch("MOVIE"),
	show_id: pbNullableString,
	season_number: pbNullableInt,
});

export const SyncResultSchema = z.object({
	pushed: z.number().int(),
	pulled: z.number().int(),
	errors: z.array(z.string()),
});
