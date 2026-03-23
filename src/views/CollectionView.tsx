import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { TvMinimalPlay } from "lucide-react";
import { useEffect, useRef } from "react";
import { Button } from "../components/atoms/Button/button";
import { Spinner } from "../components/atoms/Spinner/spinner";
import { SearchBar } from "../components/molecules/SearchBar/search-bar";
import { MovieCard } from "../components/organisms/MovieCard/movie-card";
import { useMovies } from "../features/movies/movies.queries";
import { useMoviesStore } from "../features/movies/movies.store";
import type {
	Movie,
	MovieFormat,
	MovieStatus,
	SortOption,
} from "../features/movies/movies.types";
import { useDebounce } from "../hooks/useDebounce";
import { usePullToRefresh } from "../hooks/usePullToRefresh";
import { cn } from "../lib/cn";

const TYPE_CHIPS = [
	{ label: "Movies", value: "MOVIE" as const },
	{ label: "Shows", value: "TV" as const },
];

const STATUS_CHIPS: { label: string; value: MovieStatus }[] = [
	{ label: "Owned", value: "OWNED" },
	{ label: "Wanted", value: "WANTED" },
];

const FORMAT_CHIPS: { label: string; value: MovieFormat }[] = [
	{ label: "SD", value: "SD" },
	{ label: "HD", value: "HD" },
	{ label: "4K", value: "4K" },
	{ label: "Custom", value: "CUSTOM" },
];

const COPY_CHIPS = [
	{ label: "Physical", key: "physical" as const },
	{ label: "Digital", key: "digital" as const },
];

const SORT_OPTIONS: { label: string; value: SortOption }[] = [
	{ label: "Title A→Z", value: "title_asc" },
	{ label: "Title Z→A", value: "title_desc" },
	{ label: "Newest first", value: "year_desc" },
	{ label: "Oldest first", value: "year_asc" },
	{ label: "My rating ↓", value: "rating_desc" },
	{ label: "TMDB rating ↓", value: "tmdb_rating_desc" },
];

const chipBase =
	"shrink-0 rounded-full border px-3 py-1 text-xs font-medium transition-colors";
const chipActive = "border-blue-500 bg-blue-600 text-white";
const chipInactive = "border-white/15 bg-white/5 text-white/60";
const chipHidden = "border-red-400/50 bg-red-400/10 text-red-400";

function sortMovies(movies: Movie[], sortBy: SortOption): Movie[] {
	return [...movies].sort((a, b) => {
		switch (sortBy) {
			case "title_asc":
				return a.title.localeCompare(b.title);
			case "title_desc":
				return b.title.localeCompare(a.title);
			case "year_desc":
				return (b.year ?? 0) - (a.year ?? 0);
			case "year_asc":
				return (a.year ?? 0) - (b.year ?? 0);
			case "rating_desc":
				return (b.personal_rating ?? -1) - (a.personal_rating ?? -1);
			case "tmdb_rating_desc":
				return (b.tmdb_rating ?? -1) - (a.tmdb_rating ?? -1);
			default:
				return 0;
		}
	});
}

export function CollectionView() {
	const navigate = useNavigate();
	const queryClient = useQueryClient();
	const { data: movies = [], isLoading } = useMovies();
	const {
		search,
		typeFilter,
		statusFilter,
		formatFilter,
		physicalFilter,
		digitalFilter,
		sortBy,
		setTypeFilter,
		setStatusFilter,
		setFormatFilter,
		setPhysicalFilter,
		setDigitalFilter,
		setSortBy,
		setCollectionScrollY,
		clearFilters,
	} = useMoviesStore();
	const debouncedSearch = useDebounce(search);

	const {
		containerRef,
		pullDistance,
		isRefreshing,
		onTouchStart,
		onTouchMove,
		onTouchEnd,
	} = usePullToRefresh({
		onRefresh: () => queryClient.invalidateQueries({ queryKey: ["movies"] }),
	});

	const scrollDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	// Restore scroll position after data loads.
	// Read from store imperatively so this effect only fires on isLoading transitions,
	// not on every scroll save (which would fight the user).
	// biome-ignore lint/correctness/useExhaustiveDependencies: containerRef is a stable ref — .current is intentionally omitted
	useEffect(() => {
		if (!isLoading && containerRef.current) {
			const savedY = useMoviesStore.getState().collectionScrollY;
			if (savedY > 0) containerRef.current.scrollTop = savedY;
		}
	}, [isLoading]);

	function handleScroll() {
		if (scrollDebounceRef.current) clearTimeout(scrollDebounceRef.current);
		scrollDebounceRef.current = setTimeout(() => {
			if (containerRef.current) {
				setCollectionScrollY(containerRef.current.scrollTop);
			}
		}, 150);
	}

	const hasFilters =
		typeFilter !== null ||
		statusFilter !== null ||
		formatFilter !== null ||
		physicalFilter !== null ||
		digitalFilter !== null ||
		Boolean(debouncedSearch);

	// TV_SHOW rows are container records — exclude from the flat list and TV
	// season results; they're used only as headers in the grouped TV view.
	const filtered = sortMovies(
		movies.filter((m) => {
			if (m.type === "TV_SHOW") return false;
			if (typeFilter === "MOVIE" && m.type !== "MOVIE") return false;
			if (typeFilter === "TV" && m.type !== "TV_SEASON") return false;
			if (statusFilter && m.status !== statusFilter) return false;
			if (formatFilter && m.format !== formatFilter) return false;
			if (physicalFilter !== null && Boolean(m.is_physical) !== physicalFilter)
				return false;
			if (digitalFilter !== null && Boolean(m.is_digital) !== digitalFilter)
				return false;
			if (
				debouncedSearch &&
				!m.title.toLowerCase().includes(debouncedSearch.toLowerCase())
			)
				return false;
			return true;
		}),
		sortBy,
	);

	// Build TV grouped structure when in TV mode
	const showMap = new Map(
		movies.filter((m) => m.type === "TV_SHOW").map((m) => [m.id, m]),
	);
	const tvSeasons = filtered; // all TV_SEASON when typeFilter === 'TV'
	const uniqueShowIds = [
		...new Set(
			tvSeasons.map((m) => m.show_id).filter((id): id is string => id !== null),
		),
	];
	const sortedShows = uniqueShowIds
		.map((id) => showMap.get(id))
		.filter((s): s is Movie => s !== undefined)
		.sort((a, b) => a.title.localeCompare(b.title));
	const orphanSeasons = tvSeasons.filter(
		(m) => m.show_id === null || !showMap.has(m.show_id),
	);

	return (
		<div className="flex h-full flex-col bg-gray-950 text-white">
			<div className="flex flex-col gap-2 p-4 pb-2">
				{/* Heading + sort */}
				<div className="flex items-center justify-between">
					<h1 className="text-2xl font-bold">My Collection</h1>
					<select
						value={sortBy}
						onChange={(e) => setSortBy(e.target.value as SortOption)}
						className="rounded-lg border border-white/10 bg-gray-800 px-2 py-1 text-xs text-white/70 outline-none"
					>
						{SORT_OPTIONS.map((o) => (
							<option key={o.value} value={o.value}>
								{o.label}
							</option>
						))}
					</select>
				</div>

				<SearchBar />

				{/* Filter chips */}
				<div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none]">
					{TYPE_CHIPS.map(({ label, value }) => (
						<button
							key={value}
							type="button"
							onClick={() => setTypeFilter(typeFilter === value ? null : value)}
							className={cn(
								chipBase,
								typeFilter === value ? chipActive : chipInactive,
							)}
						>
							{label}
						</button>
					))}

					<div className="w-px shrink-0 bg-white/10" />

					{STATUS_CHIPS.map(({ label, value }) => (
						<button
							key={value}
							type="button"
							onClick={() =>
								setStatusFilter(statusFilter === value ? null : value)
							}
							className={cn(
								chipBase,
								statusFilter === value ? chipActive : chipInactive,
							)}
						>
							{label}
						</button>
					))}

					<div className="w-px shrink-0 bg-white/10" />

					{FORMAT_CHIPS.map(({ label, value }) => (
						<button
							key={value}
							type="button"
							onClick={() =>
								setFormatFilter(formatFilter === value ? null : value)
							}
							className={cn(
								chipBase,
								formatFilter === value ? chipActive : chipInactive,
							)}
						>
							{label}
						</button>
					))}

					<div className="w-px shrink-0 bg-white/10" />

					{COPY_CHIPS.map(({ label, key }) => {
						const active = key === "physical" ? physicalFilter : digitalFilter;
						const setter =
							key === "physical" ? setPhysicalFilter : setDigitalFilter;
						return (
							<button
								key={key}
								type="button"
								onClick={() =>
									setter(
										active === null ? true : active === true ? false : null,
									)
								}
								className={cn(
									chipBase,
									active === true
										? chipActive
										: active === false
											? chipHidden
											: chipInactive,
								)}
							>
								{label}
							</button>
						);
					})}

					{hasFilters && (
						<button
							type="button"
							onClick={clearFilters}
							className={cn(chipBase, "text-white/40", chipInactive)}
						>
							Clear
						</button>
					)}
				</div>
			</div>

			{/* Scrollable content with pull-to-refresh */}
			<div
				ref={containerRef}
				className="flex-1 overflow-y-auto"
				onScroll={handleScroll}
				onTouchStart={onTouchStart}
				onTouchMove={onTouchMove}
				onTouchEnd={onTouchEnd}
			>
				{/* Pull-to-refresh indicator */}
				{(pullDistance > 0 || isRefreshing) && (
					<div
						className="flex items-center justify-center transition-all"
						style={{ height: isRefreshing ? 48 : pullDistance }}
					>
						<Spinner />
					</div>
				)}

				<div className="p-4 pt-2">
					{isLoading ? (
						<Spinner />
					) : movies.length === 0 ? (
						<div className="flex flex-col items-center justify-center gap-4 py-20 text-center">
							<p className="text-white/50">No movies yet.</p>
							<Button onClick={() => navigate({ to: "/movie/add" })}>
								Add your first movie
							</Button>
						</div>
					) : filtered.length === 0 ? (
						<div className="flex flex-col items-center gap-2 py-10 text-center">
							<p className="text-white/50">No results.</p>
							{hasFilters && (
								<button
									type="button"
									onClick={clearFilters}
									className="text-sm text-blue-400"
								>
									Clear filters
								</button>
							)}
						</div>
					) : typeFilter === "TV" ? (
						/* Grouped TV view — seasons nested under show headers */
						<div className="flex flex-col gap-2">
							{hasFilters && (
								<p className="text-xs text-white/40">
									{filtered.length} results
								</p>
							)}
							<div className="flex flex-col gap-6">
								{sortedShows.map((show) => {
									const seasons = tvSeasons
										.filter((m) => m.show_id === show.id)
										.sort(
											(a, b) => (a.season_number ?? 0) - (b.season_number ?? 0),
										);
									return (
										<div key={show.id}>
											{/* Show header */}
											<button
												type="button"
												className="relative mb-2 flex min-h-16 w-full overflow-hidden rounded-xl bg-gray-800 p-3 text-left"
												onClick={() =>
													navigate({
														to: "/movie/$id/edit",
														params: { id: show.id },
													})
												}
											>
												{show.poster_url && (
													<img
														src={show.poster_url}
														alt=""
														aria-hidden="true"
														className="absolute inset-0 h-full w-full object-cover object-center brightness-30 grayscale-25"
													/>
												)}
												<div className="relative flex items-center gap-2">
													<TvMinimalPlay
														size={16}
														className="shrink-0 text-blue-400"
													/>
													<p className="font-semibold text-white">
														{show.title}
													</p>
													{show.year !== null && (
														<p className="text-sm text-white/60">{show.year}</p>
													)}
												</div>
											</button>
											{/* Season grid */}
											<div className="grid grid-cols-2 gap-4">
												{seasons.map((season) => (
													<MovieCard key={season.id} movie={season} />
												))}
											</div>
										</div>
									);
								})}
								{orphanSeasons.length > 0 && (
									<div className="grid grid-cols-2 gap-4">
										{orphanSeasons.map((season) => (
											<MovieCard key={season.id} movie={season} />
										))}
									</div>
								)}
							</div>
						</div>
					) : (
						/* Flat grid — movies (+ TV seasons in all mode) */
						<div className="flex flex-col gap-2">
							{hasFilters && (
								<p className="text-xs text-white/40">
									{filtered.length} results
								</p>
							)}
							<div className="grid grid-cols-2 gap-4">
								{filtered.map((movie) => (
									<MovieCard key={movie.id} movie={movie} />
								))}
							</div>
						</div>
					)}
				</div>
			</div>

			{movies.length > 0 && (
				<div className="p-4">
					<Button
						className="w-full"
						onClick={() => navigate({ to: "/movie/add" })}
					>
						+ Add Movie/Show
					</Button>
				</div>
			)}
		</div>
	);
}
