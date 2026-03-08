import { z } from "zod";

export const MovieStatusSchema = z.enum(["OWNED", "WANTED"]);

export const MovieFormatSchema = z.enum(["SD", "HD", "4K", "CUSTOM"]);

export const MovieSchema = z.object({
	id: z.string().uuid(),
	tmdb_id: z.number().int().nullable(),
	title: z.string().min(1),
	year: z.number().int().nullable(),
	poster_url: z.string().nullable(),
	tmdb_rating: z.number().nullable(),
	personal_rating: z.number().min(1).max(10).nullable(),
	status: MovieStatusSchema,
	format: MovieFormatSchema,
	is_physical: z.number().int().min(0).max(1),
	is_digital: z.number().int().min(0).max(1),
	is_backed_up: z.number().int().min(0).max(1),
	notes: z.string().nullable(),
	deleted_at: z.string().nullable(),
	created_at: z.string(),
	updated_at: z.string(),
});

export const NewMovieSchema = MovieSchema.omit({
	id: true,
	created_at: true,
	updated_at: true,
	deleted_at: true,
}).extend({
	personal_rating: z.number().min(1).max(10).nullable().optional(),
	notes: z.string().nullable().optional(),
});

export const UpdateMovieSchema = NewMovieSchema.partial();
