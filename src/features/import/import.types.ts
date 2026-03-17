import type { MovieFormat } from "../movies/movies.types";
import type { TmdbSearchResult } from "../tmdb/tmdb.types";

export type ImportRowStatus =
	| "pending"
	| "ready"
	| "ambiguous"
	| "duplicate"
	| "not_found";

export type RawImportRow = {
	title: string;
	year: number;
	resolution: string;
};

export type ImportRow = {
	raw: RawImportRow;
	format: MovieFormat;
	status: ImportRowStatus;
	tmdbMatches: TmdbSearchResult[];
	selectedMatch: TmdbSearchResult | null;
	skip: boolean;
};
