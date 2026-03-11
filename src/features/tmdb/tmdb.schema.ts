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
