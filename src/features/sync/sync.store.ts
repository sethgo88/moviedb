import { create } from "zustand";
import type { SyncConflict } from "./sync.types";

export interface SyncToast {
	message: string;
	variant: "success" | "error";
}

interface SyncState {
	isSyncing: boolean;
	lastSyncedAt: string | null;
	error: string | null;
	conflicts: SyncConflict[];
	syncTriggerAt: number | null;
	syncToast: SyncToast | null;
	setSyncing: (b: boolean) => void;
	setLastSyncedAt: (ts: string | null) => void;
	setError: (msg: string | null) => void;
	clearError: () => void;
	setConflicts: (conflicts: SyncConflict[]) => void;
	removeConflict: (id: string) => void;
	requestSync: () => void;
}

let _toastTimer: ReturnType<typeof setTimeout> | null = null;

export const useSyncStore = create<SyncState>()((set) => ({
	isSyncing: false,
	lastSyncedAt: null,
	error: null,
	conflicts: [],
	syncTriggerAt: null,
	syncToast: null,
	setSyncing: (b) => set({ isSyncing: b }),
	setLastSyncedAt: (ts) => set({ lastSyncedAt: ts }),
	setError: (msg) => set({ error: msg }),
	clearError: () => set({ error: null }),
	setConflicts: (conflicts) => set({ conflicts }),
	removeConflict: (id) =>
		set((s) => ({ conflicts: s.conflicts.filter((c) => c.id !== id) })),
	requestSync: () => set({ syncTriggerAt: Date.now() }),
}));

/** Show a sync toast and auto-dismiss after 3 s. Safe to call from anywhere. */
export function showSyncToast(
	message: string,
	variant: "success" | "error",
): void {
	if (_toastTimer) clearTimeout(_toastTimer);
	useSyncStore.setState({ syncToast: { message, variant } });
	_toastTimer = setTimeout(() => {
		useSyncStore.setState({ syncToast: null });
	}, 3000);
}
