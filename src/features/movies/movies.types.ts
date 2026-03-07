import type { z } from "zod";
import type {
	MovieFormatSchema,
	MovieSchema,
	MovieStatusSchema,
	NewMovieSchema,
	UpdateMovieSchema,
} from "./movies.schema";

export type MovieStatus = z.infer<typeof MovieStatusSchema>;
export type MovieFormat = z.infer<typeof MovieFormatSchema>;
export type Movie = z.infer<typeof MovieSchema>;
export type NewMovie = z.infer<typeof NewMovieSchema>;
export type UpdateMovie = z.infer<typeof UpdateMovieSchema>;
