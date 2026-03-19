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
	collectionScrollY: number;
	setSearch: (q: string) => void;
	setTypeFilter: (t: TypeFilter | null) => void;
	setStatusFilter: (s: MovieStatus | null) => void;
	setFormatFilter: (f: MovieFormat | null) => void;
	setPhysicalFilter: (v: boolean | null) => void;
	setDigitalFilter: (v: boolean | null) => void;
	setSortBy: (s: SortOption) => void;
	setCollectionScrollY: (y: number) => void;
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
	collectionScrollY: 0,
	setSearch: (q) => set({ search: q, collectionScrollY: 0 }),
	setTypeFilter: (t) => set({ typeFilter: t, collectionScrollY: 0 }),
	setStatusFilter: (s) => set({ statusFilter: s, collectionScrollY: 0 }),
	setFormatFilter: (f) => set({ formatFilter: f, collectionScrollY: 0 }),
	setPhysicalFilter: (v) => set({ physicalFilter: v, collectionScrollY: 0 }),
	setDigitalFilter: (v) => set({ digitalFilter: v, collectionScrollY: 0 }),
	setSortBy: (s) => set({ sortBy: s, collectionScrollY: 0 }),
	setCollectionScrollY: (y) => set({ collectionScrollY: y }),
	// Sort is intentionally preserved when clearing filters
	clearFilters: () =>
		set({
			search: "",
			typeFilter: null,
			statusFilter: null,
			formatFilter: null,
			physicalFilter: null,
			digitalFilter: null,
			collectionScrollY: 0,
		}),
}));
