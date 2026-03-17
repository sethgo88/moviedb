import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Toast } from "@/components/atoms/Toast/toast";
import {
	executeImport,
	parseJellyfinCsv,
	processImportRows,
} from "@/features/import/import.service";
import type { ImportRow } from "@/features/import/import.types";
import { TMDB_POSTER_BASE } from "@/features/tmdb/tmdb.service";
import type { TmdbSearchResult } from "@/features/tmdb/tmdb.types";

type Phase = "pick" | "processing" | "review";
type ReviewTab = "ready" | "duplicates" | "not_found";

export function ImportView() {
	const navigate = useNavigate();
	const queryClient = useQueryClient();

	const [phase, setPhase] = useState<Phase>("pick");
	const [csvText, setCsvText] = useState("");
	const [progress, setProgress] = useState({ done: 0, total: 0 });
	const [rows, setRows] = useState<ImportRow[]>([]);
	const [activeTab, setActiveTab] = useState<ReviewTab>("ready");
	const [isImporting, setIsImporting] = useState(false);
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

	async function handleProcess() {
		const rawRows = parseJellyfinCsv(csvText);

		if (rawRows.length === 0) {
			showToast("No valid rows found — check the format", "error");
			return;
		}

		setProgress({ done: 0, total: rawRows.length });
		setPhase("processing");

		const processed = await processImportRows(rawRows, (done, total) => {
			setProgress({ done, total });
		});

		setRows(processed);
		setActiveTab("ready");
		setPhase("review");
	}

	function toggleSkip(index: number) {
		setRows((prev) =>
			prev.map((r, i) => (i === index ? { ...r, skip: !r.skip } : r)),
		);
	}

	function selectMatch(index: number, match: TmdbSearchResult) {
		setRows((prev) =>
			prev.map((r, i) =>
				i === index ? { ...r, selectedMatch: match, status: "ready" } : r,
			),
		);
	}

	async function handleConfirm() {
		setIsImporting(true);
		try {
			const { imported, skipped } = await executeImport(rows);
			await queryClient.invalidateQueries({ queryKey: ["movies"] });
			showToast(
				`Imported ${imported} movie${imported === 1 ? "" : "s"}${skipped > 0 ? `, skipped ${skipped}` : ""}`,
			);
			setTimeout(() => navigate({ to: "/" }), 1500);
		} catch {
			showToast("Import failed", "error");
			setIsImporting(false);
		}
	}

	const readyRows = rows
		.map((r, i) => ({ row: r, index: i }))
		.filter(({ row }) => row.status === "ready" || row.status === "ambiguous");
	const duplicateRows = rows
		.map((r, i) => ({ row: r, index: i }))
		.filter(({ row }) => row.status === "duplicate");
	const notFoundRows = rows
		.map((r, i) => ({ row: r, index: i }))
		.filter(({ row }) => row.status === "not_found");

	const importCount = rows.filter((r) => !r.skip).length;

	return (
		<div className="flex h-full flex-col bg-gray-950 text-white">
			<Toast
				message={toast?.message ?? ""}
				visible={toast !== null}
				variant={toast?.variant}
			/>

			{/* Header */}
			<div className="flex items-center gap-3 border-b border-white/10 p-4">
				<button
					type="button"
					className="text-blue-400 text-sm"
					onClick={() => navigate({ to: "/" })}
				>
					Cancel
				</button>
				<h1 className="flex-1 text-center text-base font-semibold">
					Import from Jellyfin CSV
				</h1>
				<div className="w-12" />
			</div>

			{/* Pick phase */}
			{phase === "pick" && (
				<div className="flex flex-1 flex-col gap-4 p-4">
					<p className="text-xs text-white/40">
						Paste your Jellyfin CSV below. Expected format:
					</p>
					<pre className="rounded-lg bg-white/5 px-3 py-2 text-xs text-white/30">
						{"Name,Year,Resolution\nThe Matrix,1999,1920 * 800"}
					</pre>
					<textarea
						className="flex-1 resize-none rounded-xl border border-white/10 bg-gray-900 p-3 text-sm text-white placeholder-white/20 outline-none focus:border-blue-500"
						placeholder="Name,Year,Resolution&#10;The Matrix,1999,1920 * 800&#10;Inception,2010,3840 * 1600"
						value={csvText}
						onChange={(e) => setCsvText(e.target.value)}
						spellCheck={false}
						autoCorrect="off"
						autoCapitalize="off"
					/>
					<button
						type="button"
						disabled={csvText.trim().length === 0}
						className="rounded-xl bg-blue-600 py-3 text-sm font-semibold text-white transition-opacity active:opacity-70 disabled:opacity-40"
						onClick={handleProcess}
					>
						Search TMDB
					</button>
				</div>
			)}

			{/* Processing phase */}
			{phase === "processing" && (
				<div className="flex flex-1 flex-col items-center justify-center gap-4 p-8">
					<p className="text-sm text-white/60">Searching TMDB…</p>
					<p className="text-lg font-semibold">
						{progress.done} of {progress.total}
					</p>
					<div className="h-2 w-full max-w-sm overflow-hidden rounded-full bg-white/10">
						<div
							className="h-full rounded-full bg-blue-500 transition-all duration-200"
							style={{
								width:
									progress.total > 0
										? `${(progress.done / progress.total) * 100}%`
										: "0%",
							}}
						/>
					</div>
				</div>
			)}

			{/* Review phase */}
			{phase === "review" && (
				<>
					{/* Tab bar */}
					<div className="flex border-b border-white/10">
						{(
							[
								{
									key: "ready" as ReviewTab,
									label: "Ready",
									count: readyRows.length,
								},
								{
									key: "duplicates" as ReviewTab,
									label: "Duplicates",
									count: duplicateRows.length,
								},
								{
									key: "not_found" as ReviewTab,
									label: "Not found",
									count: notFoundRows.length,
								},
							] as const
						).map(({ key, label, count }) => (
							<button
								key={key}
								type="button"
								className={`flex-1 py-3 text-xs font-semibold transition-colors ${
									activeTab === key
										? "border-b-2 border-blue-500 text-blue-400"
										: "text-white/40"
								}`}
								onClick={() => setActiveTab(key)}
							>
								{label} ({count})
							</button>
						))}
					</div>

					{/* Tab content */}
					<div className="flex-1 overflow-y-auto">
						{activeTab === "ready" && (
							<ul className="divide-y divide-white/5">
								{readyRows.length === 0 && (
									<li className="p-6 text-center text-sm text-white/30">
										No matches
									</li>
								)}
								{readyRows.map(({ row, index }) => (
									<li key={index} className="p-4">
										<div className="flex items-start gap-3">
											{/* Poster thumbnail */}
											{row.selectedMatch?.poster_path ? (
												<img
													src={`${TMDB_POSTER_BASE}${row.selectedMatch.poster_path}`}
													alt=""
													className="h-16 w-11 shrink-0 rounded object-cover"
												/>
											) : (
												<div className="h-16 w-11 shrink-0 rounded bg-white/10" />
											)}
											<div className="min-w-0 flex-1">
												<p className="truncate text-sm font-medium">
													{row.selectedMatch?.title ?? row.raw.title}
												</p>
												<p className="text-xs text-white/40">
													{row.selectedMatch?.release_date?.slice(0, 4) ??
														row.raw.year}{" "}
													· {row.format}
												</p>
												{/* Ambiguous picker */}
												{row.status === "ambiguous" && (
													<div className="mt-2">
														<p className="mb-1 text-xs text-amber-400">
															Multiple matches — tap to select:
														</p>
														<div className="flex gap-2 overflow-x-auto pb-1">
															{row.tmdbMatches.map((match) => (
																<button
																	key={match.id}
																	type="button"
																	className={`shrink-0 rounded-lg border p-1.5 text-left transition-colors ${
																		row.selectedMatch?.id === match.id
																			? "border-blue-500 bg-blue-500/10"
																			: "border-white/10 bg-white/5"
																	}`}
																	onClick={() => selectMatch(index, match)}
																>
																	{match.poster_path ? (
																		<img
																			src={`${TMDB_POSTER_BASE}${match.poster_path}`}
																			alt=""
																			className="h-14 w-10 rounded object-cover"
																		/>
																	) : (
																		<div className="h-14 w-10 rounded bg-white/10" />
																	)}
																	<p className="mt-1 w-10 truncate text-center text-xs text-white/60">
																		{match.release_date?.slice(0, 4)}
																	</p>
																</button>
															))}
														</div>
													</div>
												)}
											</div>
										</div>
									</li>
								))}
							</ul>
						)}

						{activeTab === "duplicates" && (
							<ul className="divide-y divide-white/5">
								{duplicateRows.length === 0 && (
									<li className="p-6 text-center text-sm text-white/30">
										No duplicates
									</li>
								)}
								{duplicateRows.map(({ row, index }) => (
									<li key={index} className="flex items-center gap-3 p-4">
										{row.selectedMatch?.poster_path ? (
											<img
												src={`${TMDB_POSTER_BASE}${row.selectedMatch.poster_path}`}
												alt=""
												className="h-16 w-11 shrink-0 rounded object-cover"
											/>
										) : (
											<div className="h-16 w-11 shrink-0 rounded bg-white/10" />
										)}
										<div className="min-w-0 flex-1">
											<p className="truncate text-sm font-medium">
												{row.selectedMatch?.title ?? row.raw.title}
											</p>
											<p className="text-xs text-white/40">
												{row.raw.year} · {row.format}
											</p>
											<p className="mt-0.5 text-xs text-white/30">
												Already in collection
											</p>
										</div>
										<button
											type="button"
											className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
												row.skip
													? "bg-white/10 text-white/40"
													: "bg-blue-600 text-white"
											}`}
											onClick={() => toggleSkip(index)}
										>
											{row.skip ? "Skip" : "Add"}
										</button>
									</li>
								))}
							</ul>
						)}

						{activeTab === "not_found" && (
							<>
								<p className="px-4 pt-3 text-xs text-white/40">
									These will be imported as manual entries (title + year only).
								</p>
								<ul className="divide-y divide-white/5">
									{notFoundRows.length === 0 && (
										<li className="p-6 text-center text-sm text-white/30">
											None
										</li>
									)}
									{notFoundRows.map(({ row, index }) => (
										<li key={index} className="flex items-center gap-3 p-4">
											<div className="h-16 w-11 shrink-0 rounded bg-white/10" />
											<div className="min-w-0 flex-1">
												<p className="truncate text-sm font-medium">
													{row.raw.title}
												</p>
												<p className="text-xs text-white/40">
													{row.raw.year} · {row.format}
												</p>
											</div>
										</li>
									))}
								</ul>
							</>
						)}
					</div>

					{/* Footer */}
					<div className="border-t border-white/10 p-4 pb-[calc(env(safe-area-inset-bottom)+16px)]">
						<button
							type="button"
							disabled={isImporting || importCount === 0}
							className="w-full rounded-xl bg-blue-600 py-3 text-sm font-semibold text-white transition-opacity active:opacity-70 disabled:opacity-40"
							onClick={handleConfirm}
						>
							{isImporting
								? "Importing…"
								: `Import ${importCount} movie${importCount === 1 ? "" : "s"}`}
						</button>
					</div>
				</>
			)}
		</div>
	);
}
