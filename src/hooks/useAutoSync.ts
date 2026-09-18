import { getCurrentWindow } from "@tauri-apps/api/window";
import { useEffect, useRef } from "react";
import { useRunSync } from "../features/sync/sync.queries";
import { showSyncToast, useSyncStore } from "../features/sync/sync.store";

const STALE_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes

export const SYNC_STALE_THRESHOLD_MS = STALE_THRESHOLD_MS;

function isStale(lastSyncedAt: string | null): boolean {
	if (!lastSyncedAt) return true;
	return Date.now() - new Date(lastSyncedAt).getTime() > STALE_THRESHOLD_MS;
}

/**
 * Mounts three auto-sync triggers:
 * 1. On mount — sync if stale (> 5 min or never synced).
 * 2. On window focus — sync if stale.
 * 3. Debounced on syncTriggerAt — fires ~1.5s after any movie mutation.
 *
 * Note: triggers 1 and 2 use useEffect to fire a mutation on a lifecycle/focus
 * event — this is not data fetching and is intentionally outside TanStack Query.
 * Toast feedback (success/error) is written to useSyncStore for global rendering
 * via showSyncToast(), which is also used by manual sync in SyncView.
 */

export function useAutoSync() {
	const { mutate: runSync } = useRunSync();
	const syncTriggerAt = useSyncStore((s) => s.syncTriggerAt);
	const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	// Capture a stable ref to runSync so effects don't re-register on every render.
	const runSyncRef = useRef(runSync);
	runSyncRef.current = runSync;

	function triggerSync() {
		runSyncRef.current(undefined, {
			onSuccess: (result) => {
				const total =
					result.pushedMovies.length +
					result.pulledMovies.length +
					result.deletedMovies.length +
					result.dedupedMovies.length;
				showSyncToast(
					total > 0 ? `Synced ${total} item${total === 1 ? "" : "s"}` : "Already up to date",
					"success",
				);
			},
			onError: () => {
				showSyncToast("Could not sync", "error");
			},
		});
	}

	// Trigger 1: sync on mount if stale.
	// biome-ignore lint/correctness/useExhaustiveDependencies: intentional one-time mount check
	useEffect(() => {
		const { lastSyncedAt, isSyncing } = useSyncStore.getState();
		if (!isSyncing && isStale(lastSyncedAt)) {
			triggerSync();
		}
	}, []);

	// Trigger 2: sync on window focus if stale.
	// biome-ignore lint/correctness/useExhaustiveDependencies: event listener setup — triggerSync captured via closure over stable ref
	useEffect(() => {
		let unlisten: (() => void) | undefined;
		getCurrentWindow()
			.onFocusChanged(({ payload: focused }) => {
				if (!focused) return;
				const { lastSyncedAt, isSyncing } = useSyncStore.getState();
				if (!isSyncing && isStale(lastSyncedAt)) {
					triggerSync();
				}
			})
			.then((fn) => {
				unlisten = fn;
			});
		return () => {
			unlisten?.();
		};
	}, []);

	// Trigger 3: debounced sync when a movie mutation calls requestSync().
	// biome-ignore lint/correctness/useExhaustiveDependencies: runSyncRef is a stable ref, not a dep
	useEffect(() => {
		if (!syncTriggerAt) return;
		if (debounceRef.current) clearTimeout(debounceRef.current);
		debounceRef.current = setTimeout(() => {
			const { isSyncing } = useSyncStore.getState();
			if (!isSyncing) triggerSync();
		}, 1500);
		return () => {
			if (debounceRef.current) clearTimeout(debounceRef.current);
		};
	}, [syncTriggerAt]);
}
