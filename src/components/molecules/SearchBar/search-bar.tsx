import { X } from "lucide-react";
import { useMoviesStore } from "../../../features/movies/movies.store";

export function SearchBar() {
	const search = useMoviesStore((s) => s.search);
	const setSearch = useMoviesStore((s) => s.setSearch);
	const hasSearch = search.length > 0;

	return (
		<div className="relative w-full">
			<input
				type="text"
				value={search}
				onChange={(e) => setSearch(e.target.value)}
				placeholder="Search movies..."
				className={`min-h-[48px] w-full rounded-lg bg-white/10 py-3 text-white outline-none placeholder:text-white/40 ${hasSearch ? "pl-4 pr-[52px]" : "px-4"}`}
			/>
			{hasSearch && (
				<button
					type="button"
					aria-label="Clear search"
					onClick={() => setSearch("")}
					className="absolute inset-y-[2px] right-[2px] flex w-11 items-center justify-center rounded-md bg-blue-600 active:bg-blue-700"
				>
					<X size={18} className="text-white" />
				</button>
			)}
		</div>
	);
}
