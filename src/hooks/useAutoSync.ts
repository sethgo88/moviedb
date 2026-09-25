import { getCurrentWindow } from "@tauri-apps/api/window";
import { useEffect, useRef } from "react";
import { usePushOneMovie, useRunSync } from "../features/sync/sync.queries";
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
 * 3. Debounced on pendingSyncMovieId — pushes only the changed movie ~1.5s after a mutation.
 *
 * Note: triggers 1 and 2 use useEffect to fire a mutation on a lifecycle/focus
 * event — this is not data fetching and is intentionally outside TanStack Query.
 * Toast feedback (success/error) is written to useSyncStore for global rendering
 * via showSyncToast(), which is also used by manual sync in SyncView.
 */

export function useAutoSync() {
	const { mutate: runSync } = useRunSync();
	const { mutate: pushOneMovie } = usePushOneMovie();
	const pendingSyncMovieId = useSyncStore((s) => s.pendingSyncMovieId);
	const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	// Capture stable refs so effects don't re-register on every render.
	const runSyncRef = useRef(runSync);
	runSyncRef.current = runSync;
	const pushOneMovieRef = useRef(pushOneMovie);
	pushOneMovieRef.current = pushOneMovie;

	function triggerSync() {
		runSyncRef.current(undefined, {
			onSuccess: (result) => {
				const total =
					result.pushedMovies.length +
					result.pulledMovies.length +
					result.deletedMovies.length +
					result.dedupedMovies.length;
				showSyncToast(
					total > 0
						? `Synced ${total} item${total === 1 ? "" : "s"}`
						: "Already up to date",
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

	// Trigger 3: push only the changed movie after a mutation.
	// Debounced 1.5s to coalesce rapid edits to the same movie.
	// biome-ignore lint/correctness/useExhaustiveDependencies: refs are stable
	useEffect(() => {
		if (!pendingSyncMovieId) return;
		const id = pendingSyncMovieId;
		if (debounceRef.current) clearTimeout(debounceRef.current);
		debounceRef.current = setTimeout(() => {
			useSyncStore.getState().clearPendingSync();
			pushOneMovieRef.current(id, {
				onSuccess: () => showSyncToast("Synced", "success"),
				onError: () => showSyncToast("Could not sync", "error"),
			});
		}, 1500);
		return () => {
			if (debounceRef.current) clearTimeout(debounceRef.current);
		};
	}, [pendingSyncMovieId]);
}
