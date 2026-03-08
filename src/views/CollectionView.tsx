import { useNavigate } from "@tanstack/react-router";
import { Button } from "../components/atoms/Button";
import { Spinner } from "../components/atoms/Spinner";
import { SearchBar } from "../components/molecules/SearchBar";
import { MovieCard } from "../components/organisms/MovieCard";
import { useMovies } from "../features/movies/movies.queries";
import { useMoviesStore } from "../features/movies/movies.store";
import { useDebounce } from "../hooks/useDebounce";

export function CollectionView() {
	const navigate = useNavigate();
	const { data: movies = [], isLoading } = useMovies();
	const { search, statusFilter, formatFilter } = useMoviesStore();
	const debouncedSearch = useDebounce(search);

	const filtered = movies.filter((m) => {
		if (statusFilter && m.status !== statusFilter) return false;
		if (formatFilter && m.format !== formatFilter) return false;
		if (
			debouncedSearch &&
			!m.title.toLowerCase().includes(debouncedSearch.toLowerCase())
		)
			return false;
		return true;
	});

	return (
		<div className="flex h-full flex-col bg-gray-950 text-white">
			<div className="p-4 pb-2">
				<h1 className="mb-3 text-2xl font-bold">My Collection</h1>
				<SearchBar />
			</div>

			<div className="flex-1 overflow-y-auto p-4 pt-2">
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
					<p className="py-10 text-center text-white/50">
						No results for &ldquo;{debouncedSearch}&rdquo;
					</p>
				) : (
					<div className="flex flex-col gap-2">
						{filtered.map((movie) => (
							<MovieCard key={movie.id} movie={movie} />
						))}
					</div>
				)}
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
