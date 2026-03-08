import type { z } from "zod";
import type { TmdbSearchResultSchema } from "./tmdb.schema";

export type TmdbSearchResult = z.infer<typeof TmdbSearchResultSchema>;
