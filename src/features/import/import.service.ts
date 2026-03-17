import {
	checkMovieDuplicate,
	checkTitleYearSimilar,
	createMovie,
} from "../movies/movies.service";
import type { MovieFormat } from "../movies/movies.types";
import {
	fetchAndCachePoster,
	searchMovieByTitleYear,
} from "../tmdb/tmdb.service";
import type { ImportRow, RawImportRow } from "./import.types";

export function parseJellyfinCsv(text: string): RawImportRow[] {
	const lines = text
		.split("\n")
		.map((l) => l.trim())
		.filter(Boolean);
	// Skip header row
	return lines
		.slice(1)
		.map((line) => {
			const parts = line.split(",");
			if (parts.length < 3) return null;
			const resolution = parts[parts.length - 1].trim();
			const yearStr = parts[parts.length - 2].trim();
			const title = parts
				.slice(0, parts.length - 2)
				.join(",")
				.trim();
			const year = parseInt(yearStr, 10);
			if (!title || Number.isNaN(year)) return null;
			return { title, year, resolution };
		})
		.filter((r): r is RawImportRow => r !== null);
}

export function mapResolutionToFormat(resolution: string): MovieFormat {
	const match = resolution.match(/(\d+)/);
	const width = match ? parseInt(match[1], 10) : 0;
	if (width >= 3840) return "4K";
	if (width >= 1280) return "HD";
	return "SD";
}

export async function processImportRows(
	rows: RawImportRow[],
	onProgress: (done: number, total: number) => void,
): Promise<ImportRow[]> {
	const results: ImportRow[] = [];

	for (let i = 0; i < rows.length; i++) {
		const raw = rows[i];
		const format = mapResolutionToFormat(raw.resolution);
		const matches = await searchMovieByTitleYear(raw.title, raw.year);

		let status: ImportRow["status"];
		let selectedMatch: ImportRow["selectedMatch"] = null;

		if (matches.length === 0) {
			const isDup = await checkTitleYearSimilar(raw.title, raw.year);
			status = isDup ? "duplicate" : "not_found";
		} else if (matches.length === 1) {
			const isDup = await checkMovieDuplicate(matches[0].id);
			status = isDup ? "duplicate" : "ready";
			selectedMatch = matches[0];
		} else {
			// Multiple matches — check if the top result is already in collection
			const isDup = await checkMovieDuplicate(matches[0].id);
			if (isDup) {
				status = "duplicate";
			} else {
				status = "ambiguous";
			}
			selectedMatch = matches[0];
		}

		results.push({
			raw,
			format,
			status,
			tmdbMatches: matches,
			selectedMatch,
			skip: status === "duplicate",
		});

		onProgress(i + 1, rows.length);

		// Throttle to ~4 req/sec
		if (i < rows.length - 1) {
			await new Promise((resolve) => setTimeout(resolve, 250));
		}
	}

	return results;
}

export async function executeImport(
	rows: ImportRow[],
): Promise<{ imported: number; skipped: number }> {
	let imported = 0;
	let skipped = 0;

	for (const row of rows) {
		if (row.skip) {
			skipped++;
			continue;
		}

		const match = row.selectedMatch;
		let posterUrl: string | null = null;

		if (match?.poster_path) {
			try {
				posterUrl = await fetchAndCachePoster(match.id, match.poster_path);
			} catch {
				// silent — poster missing is non-fatal
			}
		}

		const releaseYear =
			match?.release_date && match.release_date.length >= 4
				? parseInt(match.release_date.slice(0, 4), 10)
				: row.raw.year;

		await createMovie({
			tmdb_id: match?.id ?? null,
			title: match?.title ?? row.raw.title,
			year: releaseYear,
			poster_url: posterUrl,
			tmdb_rating: match?.vote_average ?? null,
			personal_rating: null,
			status: "OWNED",
			format: row.format,
			is_physical: 0,
			is_digital: 1,
			is_backed_up: 0,
			notes: null,
			type: "MOVIE",
			show_id: null,
			season_number: null,
		});

		imported++;
	}

	return { imported, skipped };
}
