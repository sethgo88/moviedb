import { create } from "zustand";

interface SyncState {
	isSyncing: boolean;
	lastSyncedAt: string | null;
	error: string | null;
	pendingDeletes: number;
	setSyncing: (b: boolean) => void;
	setLastSyncedAt: (ts: string | null) => void;
	setError: (msg: string | null) => void;
	clearError: () => void;
	setPendingDeletes: (n: number) => void;
}

export const useSyncStore = create<SyncState>()((set) => ({
	isSyncing: false,
	lastSyncedAt: null,
	error: null,
	pendingDeletes: 0,
	setSyncing: (b) => set({ isSyncing: b }),
	setLastSyncedAt: (ts) => set({ lastSyncedAt: ts }),
	setError: (msg) => set({ error: msg }),
	clearError: () => set({ error: null }),
	setPendingDeletes: (n) => set({ pendingDeletes: n }),
}));
