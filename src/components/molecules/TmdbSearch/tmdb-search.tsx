import { Search, X } from "lucide-react";
import { useState } from "react";
import { useTmdbSearch } from "../../../features/tmdb/tmdb.queries";
import {
	fetchAndCachePoster,
	TMDB_POSTER_BASE,
} from "../../../features/tmdb/tmdb.service";
import type { TmdbSearchResult } from "../../../features/tmdb/tmdb.types";
import { cn } from "../../../lib/cn";

interface TmdbSearchProps {
	isOpen: boolean;
	onClose: () => void;
	onSelect: (result: TmdbSearchResult, posterDataUrl: string | null) => void;
}

export function TmdbSearch({ isOpen, onClose, onSelect }: TmdbSearchProps) {
	const [query, setQuery] = useState("");
	const [loadingId, setLoadingId] = useState<number | null>(null);
	const { data: results, isFetching, error } = useTmdbSearch(query);

	async function handleSelect(result: TmdbSearchResult) {
		setLoadingId(result.id);
		let dataUrl: string | null = null;
		if (result.poster_path) {
			try {
				dataUrl = await fetchAndCachePoster(result.id, result.poster_path);
			} catch {
				// poster unavailable — other fields still applied
			}
		}
		setLoadingId(null);
		setQuery("");
		onSelect(result, dataUrl);
	}

	return (
		<>
			{/* Overlay */}
			<button
				type="button"
				aria-label="Close search"
				className={cn(
					"fixed inset-0 z-40 w-full bg-black/60 transition-opacity duration-300",
					isOpen ? "opacity-100" : "pointer-events-none opacity-0",
				)}
				onClick={onClose}
			/>

			{/* Sheet */}
			<div
				className={cn(
					"fixed inset-x-0 bottom-0 z-50 flex flex-col rounded-t-2xl bg-gray-900 transition-transform duration-300",
					isOpen ? "translate-y-0" : "translate-y-full",
				)}
				style={{
					height: "80vh",
					paddingBottom: "calc(env(safe-area-inset-bottom) + 15px)",
				}}
			>
				{/* Header */}
				<div className="flex items-center gap-3 border-b border-white/10 p-4">
					<Search size={18} className="shrink-0 text-white/40" />
					<input
						type="search"
						placeholder="Search TMDB…"
						value={query}
						onChange={(e) => setQuery(e.target.value)}
						className="flex-1 bg-transparent text-white placeholder-white/30 outline-none"
						// biome-ignore lint/a11y/noAutofocus: intentional for search sheet UX
						autoFocus={isOpen}
					/>
					<button
						type="button"
						aria-label="Close"
						onClick={onClose}
						className="text-white/40"
					>
						<X size={20} />
					</button>
				</div>

				{/* Results */}
				<div className="flex-1 overflow-y-auto">
					{isFetching && (
						<p className="p-4 text-center text-sm text-white/40">Searching…</p>
					)}

					{error && (
						<p className="p-4 text-center text-sm text-red-400">
							Search failed. Check your connection.
						</p>
					)}

					{!isFetching && !error && results && results.length === 0 && (
						<p className="p-4 text-center text-sm text-white/40">
							No results found.
						</p>
					)}

					{results && results.length > 0 && (
						<ul>
							{results.map((result) => {
								const year = result.release_date
									? result.release_date.slice(0, 4)
									: null;
								const isLoading = loadingId === result.id;

								return (
									<li key={result.id}>
										<button
											type="button"
											disabled={loadingId !== null}
											className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors active:bg-white/5 disabled:opacity-50"
											onClick={() => handleSelect(result)}
										>
											{/* Poster thumbnail */}
											<div className="h-14 w-10 shrink-0 overflow-hidden rounded bg-white/10">
												{result.poster_path ? (
													<img
														src={`${TMDB_POSTER_BASE}${result.poster_path}`}
														alt={result.title}
														className="h-full w-full object-cover"
													/>
												) : (
													<div className="h-full w-full" />
												)}
											</div>

											<div className="min-w-0 flex-1">
												<p className="truncate font-medium text-white">
													{result.title}
												</p>
												{year && (
													<p className="text-sm text-white/50">{year}</p>
												)}
												{result.vote_average > 0 && (
													<p className="text-xs text-white/40">
														★ {result.vote_average.toFixed(1)}
													</p>
												)}
											</div>

											{isLoading && (
												<span className="text-xs text-white/40">Loading…</span>
											)}
										</button>
									</li>
								);
							})}
						</ul>
					)}

					{!query && !results && (
						<p className="p-4 text-center text-sm text-white/30">
							Type to search for a movie
						</p>
					)}
				</div>
			</div>
		</>
	);
}
