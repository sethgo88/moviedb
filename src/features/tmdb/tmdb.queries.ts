import { useQuery } from "@tanstack/react-query";
import { useDebounce } from "../../hooks/useDebounce";
import { searchMovies } from "./tmdb.service";

export function useTmdbSearch(query: string) {
	const debounced = useDebounce(query, 400);
	return useQuery({
		queryKey: ["tmdb", "search", debounced],
		queryFn: () => searchMovies(debounced),
		enabled: debounced.trim().length >= 2,
		staleTime: 5 * 60 * 1000,
	});
}
