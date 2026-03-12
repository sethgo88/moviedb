import { z } from "zod";

export const TmdbSearchResultSchema = z.object({
	id: z.number().int(),
	title: z.string(),
	release_date: z.string().optional().default(""),
	poster_path: z.string().nullable(),
	vote_average: z.number(),
});

export const TmdbSearchResponseSchema = z.object({
	results: z.array(TmdbSearchResultSchema),
	total_results: z.number(),
});

export const TmdbMovieDetailsSchema = z.object({
	id: z.number().int(),
	poster_path: z.string().nullable(),
});

export const TmdbTvSearchResultSchema = z.object({
	id: z.number().int(),
	name: z.string(),
	first_air_date: z.string().optional().default(""),
	poster_path: z.string().nullable(),
	vote_average: z.number(),
});

export const TmdbTvSearchResponseSchema = z.object({
	results: z.array(TmdbTvSearchResultSchema),
	total_results: z.number(),
});

export const TmdbShowDetailsSchema = z.object({
	id: z.number().int(),
	poster_path: z.string().nullable(),
});

export const TmdbSeasonDetailsSchema = z.object({
	id: z.number().int(),
	season_number: z.number().int(),
	poster_path: z.string().nullable(),
});
