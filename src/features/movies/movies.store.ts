import { create } from "zustand";
import type { MovieFormat, MovieStatus } from "./movies.types";

interface MoviesState {
	search: string;
	statusFilter: MovieStatus | null;
	formatFilter: MovieFormat | null;
	selectedMovieId: string | null;
	setSearch: (q: string) => void;
	setStatusFilter: (s: MovieStatus | null) => void;
	setFormatFilter: (f: MovieFormat | null) => void;
	setSelectedMovieId: (id: string | null) => void;
	clearFilters: () => void;
}

export const useMoviesStore = create<MoviesState>()((set) => ({
	search: "",
	statusFilter: null,
	formatFilter: null,
	selectedMovieId: null,
	setSearch: (q) => set({ search: q }),
	setStatusFilter: (s) => set({ statusFilter: s }),
	setFormatFilter: (f) => set({ formatFilter: f }),
	setSelectedMovieId: (id) => set({ selectedMovieId: id }),
	clearFilters: () =>
		set({ search: "", statusFilter: null, formatFilter: null }),
}));
