import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Toast } from "../components/atoms/Toast/toast";
import { ConfirmSheet } from "../components/molecules/ConfirmSheet/confirm-sheet";
import {
	exportCollectionAsCsv,
	exportCollectionAsJson,
} from "../features/movies/movies.service";
import {
	clearPosterCache,
	getPosterCacheSize,
	refreshTmdbData,
} from "../features/tmdb/tmdb.service";

function formatBytes(bytes: number): string {
	if (bytes === 0) return "0 B";
	if (bytes < 1024) return `${bytes} B`;
	if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
	return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function SettingsView() {
	const queryClient = useQueryClient();
	const navigate = useNavigate();

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

	const { mutate: doRefreshTmdb, isPending: isRefreshing } = useMutation({
		mutationFn: refreshTmdbData,
		onSuccess: (count) => {
			queryClient.invalidateQueries({ queryKey: ["posterCacheSize"] });
			queryClient.invalidateQueries({ queryKey: ["movies"] });
			showToast(
				count > 0
					? `Updated ${count} title${count === 1 ? "" : "s"}`
					: "All titles already up to date",
			);
		},
		onError: () => showToast("Failed to refresh TMDB data", "error"),
	});

	const { mutate: doExportJson, isPending: isExportingJson } = useMutation({
		mutationFn: exportCollectionAsJson,
		onSuccess: () => showToast("Exported to Downloads"),
		onError: () => showToast("Export failed", "error"),
	});

	const { mutate: doExportCsv, isPending: isExportingCsv } = useMutation({
		mutationFn: exportCollectionAsCsv,
		onSuccess: () => showToast("Exported to Downloads"),
		onError: () => showToast("Export failed", "error"),
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
				{/* TMDB */}
				<section className="flex flex-col gap-3">
					<h2 className="text-xs font-semibold uppercase tracking-widest text-white/40">
						TMDB
					</h2>
					<div className="rounded-2xl border border-white/10 bg-gray-900">
						<div className="px-4 py-3.5">
							<p className="text-sm font-medium text-white">
								Refresh TMDB Data
							</p>
							<p className="mt-0.5 text-xs text-white/40">
								Re-fetch year, rating, and poster for all TMDB-linked titles.
							</p>
						</div>
						<div className="h-px bg-white/10" />
						<button
							type="button"
							disabled={isRefreshing}
							className="w-full px-4 py-3.5 text-left text-sm font-medium text-blue-400 transition-opacity active:opacity-70 disabled:opacity-40"
							onClick={() => doRefreshTmdb()}
						>
							{isRefreshing ? "Refreshing…" : "Refresh TMDB Data"}
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

				{/* Collection */}
				<section className="flex flex-col gap-3">
					<h2 className="text-xs font-semibold uppercase tracking-widest text-white/40">
						Collection
					</h2>
					<div className="rounded-2xl border border-white/10 bg-gray-900">
						<button
							type="button"
							disabled={isExportingJson}
							className="w-full px-4 py-3.5 text-left text-sm font-medium text-blue-400 transition-opacity active:opacity-70 disabled:opacity-40"
							onClick={() => doExportJson()}
						>
							{isExportingJson ? "Exporting…" : "Export as JSON"}
						</button>
						<div className="h-px bg-white/10" />
						<button
							type="button"
							disabled={isExportingCsv}
							className="w-full px-4 py-3.5 text-left text-sm font-medium text-blue-400 transition-opacity active:opacity-70 disabled:opacity-40"
							onClick={() => doExportCsv()}
						>
							{isExportingCsv ? "Exporting…" : "Export as CSV"}
						</button>
						<div className="h-px bg-white/10" />
						<button
							type="button"
							className="w-full px-4 py-3.5 text-left text-sm font-medium text-blue-400 transition-opacity active:opacity-70"
							onClick={() => navigate({ to: "/import" })}
						>
							Import from Jellyfin CSV
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
