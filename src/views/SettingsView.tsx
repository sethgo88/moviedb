import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Toast } from "../components/atoms/Toast/toast";
import { ConfirmSheet } from "../components/molecules/ConfirmSheet/confirm-sheet";
import {
	clearPosterCache,
	getPosterCacheSize,
	refreshUncachedPosters,
} from "../features/tmdb/tmdb.service";
import { configurePb, POCKETBASE_URL_KEY } from "../lib/pocketbase";

function formatBytes(bytes: number): string {
	if (bytes === 0) return "0 B";
	if (bytes < 1024) return `${bytes} B`;
	if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
	return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function SettingsView() {
	const queryClient = useQueryClient();

	// PocketBase URL
	const [pbUrl, setPbUrl] = useState(
		() => localStorage.getItem(POCKETBASE_URL_KEY) ?? "",
	);
	const [toast, setToast] = useState<{
		message: string;
		variant: "success" | "error";
	} | null>(null);

	function showToast(
		message: string,
		variant: "success" | "error" = "success",
	) {
		setToast({ message, variant });
		setTimeout(() => setToast(null), 3000);
	}

	function handleSavePbUrl() {
		configurePb(pbUrl.trim());
		showToast("Server URL saved");
	}

	// Poster cache
	const { data: cacheBytes = 0 } = useQuery({
		queryKey: ["posterCacheSize"],
		queryFn: getPosterCacheSize,
	});

	const [showClearConfirm, setShowClearConfirm] = useState(false);

	const { mutate: doClearCache, isPending: isClearing } = useMutation({
		mutationFn: clearPosterCache,
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["posterCacheSize"] });
			setShowClearConfirm(false);
			showToast("Cache cleared");
		},
		onError: () => {
			setShowClearConfirm(false);
			showToast("Failed to clear cache", "error");
		},
	});

	const { mutate: doRefreshPosters, isPending: isRefreshing } = useMutation({
		mutationFn: refreshUncachedPosters,
		onSuccess: (count) => {
			queryClient.invalidateQueries({ queryKey: ["posterCacheSize"] });
			showToast(
				count > 0
					? `Cached ${count} poster${count === 1 ? "" : "s"}`
					: "All posters already cached",
			);
		},
		onError: () => showToast("Failed to refresh posters", "error"),
	});

	return (
		<div className="flex h-full flex-col overflow-y-auto bg-gray-950 text-white">
			<Toast
				message={toast?.message ?? ""}
				visible={toast !== null}
				variant={toast?.variant}
			/>

			{/* Header */}
			<div className="border-b border-white/10 p-4">
				<h1 className="text-lg font-semibold">Settings</h1>
			</div>

			<div className="flex flex-col gap-6 p-4">
				{/* PocketBase */}
				<section className="flex flex-col gap-3">
					<h2 className="text-xs font-semibold uppercase tracking-widest text-white/40">
						PocketBase Sync
					</h2>
					<div className="flex flex-col gap-2 rounded-2xl border border-white/10 bg-gray-900 p-4">
						<label htmlFor="pb-url" className="text-sm text-white/60">
							Server URL
						</label>
						<input
							id="pb-url"
							type="url"
							value={pbUrl}
							onChange={(e) => setPbUrl(e.target.value)}
							placeholder="http://192.168.1.x:8090"
							className="rounded-lg border border-white/10 bg-gray-800 px-3 py-2.5 text-sm text-white placeholder-white/30 outline-none transition-colors focus:border-blue-500"
						/>
						<button
							type="button"
							className="mt-1 rounded-lg bg-blue-600 py-2.5 text-sm font-semibold text-white transition-opacity active:opacity-70"
							onClick={handleSavePbUrl}
						>
							Save
						</button>
					</div>
				</section>

				{/* Posters */}
				<section className="flex flex-col gap-3">
					<h2 className="text-xs font-semibold uppercase tracking-widest text-white/40">
						Posters
					</h2>
					<div className="rounded-2xl border border-white/10 bg-gray-900">
						<div className="px-4 py-3.5">
							<p className="text-sm font-medium text-white">
								Refresh TMDB Posters
							</p>
							<p className="mt-0.5 text-xs text-white/40">
								Download posters for any movies missing a cached image.
							</p>
						</div>
						<div className="h-px bg-white/10" />
						<button
							type="button"
							disabled={isRefreshing}
							className="w-full px-4 py-3.5 text-left text-sm font-medium text-blue-400 transition-opacity active:opacity-70 disabled:opacity-40"
							onClick={() => doRefreshPosters()}
						>
							{isRefreshing ? "Refreshing…" : "Refresh Posters"}
						</button>
					</div>
				</section>

				{/* Poster Cache */}
				<section className="flex flex-col gap-3">
					<h2 className="text-xs font-semibold uppercase tracking-widest text-white/40">
						Poster Cache
					</h2>
					<div className="rounded-2xl border border-white/10 bg-gray-900">
						<div className="flex items-center justify-between px-4 py-3.5">
							<span className="text-sm text-white/80">Cache size</span>
							<span className="text-sm text-white/50">
								{formatBytes(cacheBytes)}
							</span>
						</div>
						<div className="h-px bg-white/10" />
						<button
							type="button"
							disabled={isClearing || cacheBytes === 0}
							className="w-full px-4 py-3.5 text-left text-sm font-medium text-red-400 transition-opacity active:opacity-70 disabled:opacity-30"
							onClick={() => setShowClearConfirm(true)}
						>
							Clear Poster Cache
						</button>
					</div>
				</section>

				{/* About */}
				<section className="flex flex-col gap-3">
					<h2 className="text-xs font-semibold uppercase tracking-widest text-white/40">
						About
					</h2>
					<div className="rounded-2xl border border-white/10 bg-gray-900">
						<div className="flex items-center justify-between px-4 py-3.5">
							<span className="text-sm text-white/80">Version</span>
							<span className="text-sm text-white/50">0.1.0</span>
						</div>
					</div>
				</section>
			</div>

			<ConfirmSheet
				isOpen={showClearConfirm}
				title="Clear Poster Cache"
				message={`Delete all cached posters (${formatBytes(cacheBytes)})? They will be re-downloaded when needed.`}
				confirmLabel="Clear"
				isDangerous
				onConfirm={() => doClearCache()}
				onCancel={() => setShowClearConfirm(false)}
			/>
		</div>
	);
}
