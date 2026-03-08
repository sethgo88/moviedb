import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
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
		statusFilter,
		formatFilter,
		physicalFilter,
		digitalFilter,
		sortBy,
		setStatusFilter,
		setFormatFilter,
		setPhysicalFilter,
		setDigitalFilter,
		setSortBy,
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

	const hasFilters =
		statusFilter !== null ||
		formatFilter !== null ||
		physicalFilter !== null ||
		digitalFilter !== null ||
		Boolean(debouncedSearch);

	const filtered = sortMovies(
		movies.filter((m) => {
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
								onClick={() => setter(active === true ? null : true)}
								className={cn(
									chipBase,
									active === true ? chipActive : chipInactive,
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
					) : (
						<div className="flex flex-col gap-2">
							{/* Count badge */}
							{hasFilters && (
								<p className="text-xs text-white/40">
									{filtered.length} of {movies.length} movies
								</p>
							)}
							{filtered.map((movie) => (
								<MovieCard key={movie.id} movie={movie} />
							))}
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
						+ Add Movie
					</Button>
				</div>
			)}
		</div>
	);
}
