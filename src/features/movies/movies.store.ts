import { create } from "zustand";
import type { MovieFormat, MovieStatus } from "./movies.types";

interface MoviesState {
	search: string;
	statusFilter: MovieStatus | null;
	formatFilter: MovieFormat | null;
	physicalFilter: boolean | null;
	digitalFilter: boolean | null;
	selectedMovieId: string | null;
	setSearch: (q: string) => void;
	setStatusFilter: (s: MovieStatus | null) => void;
	setFormatFilter: (f: MovieFormat | null) => void;
	setPhysicalFilter: (v: boolean | null) => void;
	setDigitalFilter: (v: boolean | null) => void;
	setSelectedMovieId: (id: string | null) => void;
	clearFilters: () => void;
}

export const useMoviesStore = create<MoviesState>()((set) => ({
	search: "",
	statusFilter: null,
	formatFilter: null,
	physicalFilter: null,
	digitalFilter: null,
	selectedMovieId: null,
	setSearch: (q) => set({ search: q }),
	setStatusFilter: (s) => set({ statusFilter: s }),
	setFormatFilter: (f) => set({ formatFilter: f }),
	setPhysicalFilter: (v) => set({ physicalFilter: v }),
	setDigitalFilter: (v) => set({ digitalFilter: v }),
	setSelectedMovieId: (id) => set({ selectedMovieId: id }),
	clearFilters: () =>
		set({
			search: "",
			statusFilter: null,
			formatFilter: null,
			physicalFilter: null,
			digitalFilter: null,
		}),
}));
