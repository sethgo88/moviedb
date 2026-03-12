import type { z } from "zod";
import type {
	TmdbSearchResultSchema,
	TmdbSeasonDetailsSchema,
	TmdbShowDetailsSchema,
	TmdbTvSearchResultSchema,
} from "./tmdb.schema";

export type TmdbSearchResult = z.infer<typeof TmdbSearchResultSchema>;
export type TmdbTvSearchResult = z.infer<typeof TmdbTvSearchResultSchema>;
export type TmdbShowDetails = z.infer<typeof TmdbShowDetailsSchema>;
export type TmdbSeasonDetails = z.infer<typeof TmdbSeasonDetailsSchema>;
