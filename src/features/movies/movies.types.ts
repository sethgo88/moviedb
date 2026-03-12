import type { z } from "zod";
import type {
	MovieFormatSchema,
	MovieSchema,
	MovieStatusSchema,
	MovieTypeSchema,
	NewMovieSchema,
	UpdateMovieSchema,
} from "./movies.schema";

export type MovieStatus = z.infer<typeof MovieStatusSchema>;
export type MovieFormat = z.infer<typeof MovieFormatSchema>;
export type MovieType = z.infer<typeof MovieTypeSchema>;
export type Movie = z.infer<typeof MovieSchema>;
export type NewMovie = z.infer<typeof NewMovieSchema>;
export type UpdateMovie = z.infer<typeof UpdateMovieSchema>;

export type SortOption =
	| "title_asc"
	| "title_desc"
	| "year_desc"
	| "year_asc"
	| "rating_desc"
	| "tmdb_rating_desc";
