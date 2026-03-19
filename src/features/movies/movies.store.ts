import { create } from "zustand";
import type { MovieFormat, MovieStatus, SortOption } from "./movies.types";

export type TypeFilter = "MOVIE" | "TV";

interface MoviesState {
	search: string;
	typeFilter: TypeFilter | null;
	statusFilter: MovieStatus | null;
	formatFilter: MovieFormat | null;
	physicalFilter: boolean | null;
	digitalFilter: boolean | null;
	sortBy: SortOption;
	setSearch: (q: string) => void;
	setTypeFilter: (t: TypeFilter | null) => void;
	setStatusFilter: (s: MovieStatus | null) => void;
	setFormatFilter: (f: MovieFormat | null) => void;
	setPhysicalFilter: (v: boolean | null) => void;
	setDigitalFilter: (v: boolean | null) => void;
	setSortBy: (s: SortOption) => void;
	clearFilters: () => void;
}

export const useMoviesStore = create<MoviesState>()((set) => ({
	search: "",
	typeFilter: null,
	statusFilter: null,
	formatFilter: null,
	physicalFilter: null,
	digitalFilter: null,
	sortBy: "title_asc",
	setSearch: (q) => set({ search: q }),
	setTypeFilter: (t) => set({ typeFilter: t }),
	setStatusFilter: (s) => set({ statusFilter: s }),
	setFormatFilter: (f) => set({ formatFilter: f }),
	setPhysicalFilter: (v) => set({ physicalFilter: v }),
	setDigitalFilter: (v) => set({ digitalFilter: v }),
	setSortBy: (s) => set({ sortBy: s }),
	// Sort is intentionally preserved when clearing filters
	clearFilters: () =>
		set({
			search: "",
			typeFilter: null,
			statusFilter: null,
			formatFilter: null,
			physicalFilter: null,
			digitalFilter: null,
		}),
}));
