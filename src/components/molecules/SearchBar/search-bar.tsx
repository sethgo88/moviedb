import { useMoviesStore } from "../../../features/movies/movies.store";

export function SearchBar() {
	const search = useMoviesStore((s) => s.search);
	const setSearch = useMoviesStore((s) => s.setSearch);

	return (
		<input
			type="search"
			value={search}
			onChange={(e) => setSearch(e.target.value)}
			placeholder="Search movies..."
			className="min-h-[48px] w-full rounded-lg bg-white/10 px-4 py-3 text-white outline-none placeholder:text-white/40"
		/>
	);
}
