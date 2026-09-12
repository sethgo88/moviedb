import { create } from "zustand";
import type { TmdbSearchResult, TmdbTvSearchResult } from "./tmdb.types";

export type PendingTmdbSelection =
	| { type: "MOVIE"; result: TmdbSearchResult }
	| { type: "TV"; result: TmdbTvSearchResult };

interface TmdbStoreState {
	pendingSelection: PendingTmdbSelection | null;
	setPendingSelection: (s: PendingTmdbSelection | null) => void;
}

export const useTmdbStore = create<TmdbStoreState>()((set) => ({
	pendingSelection: null,
	setPendingSelection: (s) => set({ pendingSelection: s }),
}));
