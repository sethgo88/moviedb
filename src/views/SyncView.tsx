import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Fragment, useEffect, useState } from "react";
import { Spinner } from "../components/atoms/Spinner/spinner";
import { movieKeys } from "../features/movies/movies.queries";
import { useRunSync } from "../features/sync/sync.queries";
import { resolveConflict } from "../features/sync/sync.service";
import { showSyncToast, useSyncStore } from "../features/sync/sync.store";
import type { SyncConflict } from "../features/sync/sync.types";
import { autoLogin, isSupabaseAuthenticated } from "../lib/supabase";

// ─── helpers ────────────────────────────────────────────────────────────────

function formatRelative(iso: string): string {
	const diff = Date.now() - new Date(iso).getTime();
	const mins = Math.floor(diff / 60_000);
	if (mins < 1) return "just now";
	if (mins < 60) return `${mins}m ago`;
	const hrs = Math.floor(mins / 60);
	if (hrs < 24) return `${hrs}h ago`;
	return `${Math.floor(hrs / 24)}d ago`;
}

// Fields shown in the conflict diff (label → key path on SupabaseMovieRecord).
const DIFF_FIELDS: { label: string; key: keyof SyncConflict["local"] }[] = [
	{ label: "Status", key: "status" },
	{ label: "Format", key: "format" },
	{ label: "Rating", key: "personal_rating" },
	{ label: "Year", key: "year" },
	{ label: "Physical", key: "is_physical" },
	{ label: "Digital", key: "is_digital" },
	{ label: "Backed up", key: "is_backed_up" },
	{ label: "Notes", key: "notes" },
];

function formatDiffValue(val: unknown): string {
	if (val === null || val === undefined) return "—";
	if (typeof val === "boolean") return val ? "Yes" : "No";
	return String(val);
}

// ─── Conflict card ───────────────────────────────────────────────────────────

function ConflictCard({
	conflict,
	onResolved,
}: {
	conflict: SyncConflict;
	onResolved: () => void;
}) {
	const queryClient = useQueryClient();
	const [resolving, setResolving] = useState(false);
	const [resolveError, setResolveError] = useState<string | null>(null);

	const changedFields = DIFF_FIELDS.filter(
		({ key }) => conflict.local[key] !== conflict.remote[key],
	);

	async function handleResolve(winner: "local" | "remote") {
		setResolving(true);
		setResolveError(null);
		try {
			await resolveConflict(conflict, winner);
			useSyncStore.getState().removeConflict(conflict.id);
			queryClient.invalidateQueries({ queryKey: movieKeys.all });
			onResolved();
		} catch (e) {
			setResolveError(e instanceof Error ? e.message : "Resolution failed");
		} finally {
			setResolving(false);
		}
	}

	return (
		<div className="rounded-2xl border border-yellow-500/30 bg-yellow-500/5">
			{/* Header */}
			<div className="flex items-center gap-2 px-4 py-3">
				<AlertTriangle size={14} className="shrink-0 text-yellow-400" />
				<p className="flex-1 text-sm font-semibold text-white">
					{conflict.title}
				</p>
			</div>

			<div className="h-px bg-white/10" />

			{/* Diff table */}
			<div className="px-4 py-3">
				<div className="grid grid-cols-[auto_1fr_1fr] gap-x-3 gap-y-1.5">
					<div className="text-xs font-semibold text-white/30" />
					<p className="text-xs font-semibold text-blue-400">Local</p>
					<p className="text-xs font-semibold text-purple-400">Remote</p>
					{changedFields.length === 0 ? (
						<p className="col-span-3 text-xs text-white/40">
							Timestamps differ only — both versions have identical content.
						</p>
					) : (
						changedFields.map(({ label, key }) => (
							<Fragment key={label}>
								<p className="text-xs text-white/40">{label}</p>
								<p className="truncate text-xs text-white/80">
									{formatDiffValue(conflict.local[key])}
								</p>
								<p className="truncate text-xs text-white/80">
									{formatDiffValue(conflict.remote[key])}
								</p>
							</Fragment>
						))
					)}
					{/* Modified timestamps */}
					<p className="text-xs text-white/30">Modified</p>
					<p className="text-xs text-white/50">
						{formatRelative(conflict.local.updated_at)}
					</p>
					<p className="text-xs text-white/50">
						{formatRelative(conflict.remote.updated_at)}
					</p>
				</div>
			</div>

			<div className="h-px bg-white/10" />

			{resolveError && (
				<>
					<div className="h-px bg-white/10" />
					<p className="px-4 py-2 text-xs text-red-400">{resolveError}</p>
				</>
			)}

			<div className="h-px bg-white/10" />

			{/* Resolution buttons */}
			<div className="flex gap-2 px-4 py-3">
				<button
					type="button"
					disabled={resolving}
					onClick={() => handleResolve("local")}
					className="flex-1 rounded-lg border border-blue-500/40 bg-blue-600/20 py-2 text-xs font-semibold text-blue-300 transition-opacity active:opacity-70 disabled:opacity-40"
				>
					Keep Local
				</button>
				<button
					type="button"
					disabled={resolving}
					onClick={() => handleResolve("remote")}
					className="flex-1 rounded-lg border border-purple-500/40 bg-purple-600/20 py-2 text-xs font-semibold text-purple-300 transition-opacity active:opacity-70 disabled:opacity-40"
				>
					Keep Remote
				</button>
			</div>
		</div>
	);
}

// ─── Signing-in state ────────────────────────────────────────────────────────

function SigningInState({ error }: { error: string | null }) {
	return (
		<div className="flex flex-col items-center gap-3 py-8 text-center">
			{error ? (
				<>
					<AlertTriangle className="h-8 w-8 text-red-400" />
					<p className="text-sm text-red-400">{error}</p>
				</>
			) : (
				<>
					<Spinner />
					<p className="text-sm text-white/50">Signing in…</p>
				</>
			)}
		</div>
	);
}

// ─── Resolve all button ──────────────────────────────────────────────────────

function ResolveAllButton({ conflicts }: { conflicts: SyncConflict[] }) {
	const queryClient = useQueryClient();
	const [resolving, setResolving] = useState(false);

	const timestampOnly = conflicts.filter((c) =>
		DIFF_FIELDS.every(({ key }) => c.local[key] === c.remote[key]),
	);

	if (timestampOnly.length === 0) return null;

	async function handleResolveAll() {
		setResolving(true);
		try {
			for (const conflict of timestampOnly) {
				await resolveConflict(conflict, "local");
				useSyncStore.getState().removeConflict(conflict.id);
			}
			queryClient.invalidateQueries({ queryKey: movieKeys.all });
			showSyncToast(
				`Resolved ${timestampOnly.length} timestamp conflicts`,
				"success",
			);
		} catch (e) {
			showSyncToast(
				e instanceof Error ? e.message : "Bulk resolve failed",
				"error",
			);
		} finally {
			setResolving(false);
		}
	}

	return (
		<button
			type="button"
			disabled={resolving}
			onClick={handleResolveAll}
			className="text-xs font-semibold text-yellow-400 underline underline-offset-2 transition-opacity active:opacity-70 disabled:opacity-40"
		>
			{resolving ? "Resolving…" : `Resolve all (${timestampOnly.length})`}
		</button>
	);
}

// ─── Sync controls ───────────────────────────────────────────────────────────

function SyncControls() {
	const { isSyncing, lastSyncedAt, error, conflicts } = useSyncStore();
	const { mutate: runSync, data: syncResult } = useRunSync();

	function handleSync() {
		runSync(undefined, {
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
			onError: (e) => {
				showSyncToast(e instanceof Error ? e.message : "Sync failed", "error");
			},
		});
	}

	const hasAnyResult =
		syncResult &&
		(syncResult.pulledMovies.length > 0 ||
			syncResult.pushedMovies.length > 0 ||
			syncResult.deletedMovies.length > 0 ||
			syncResult.dedupedMovies.length > 0 ||
			syncResult.errors.length > 0);

	return (
		<div className="flex flex-col gap-4">
			{/* Sync button + status */}
			<div className="rounded-2xl border border-white/10 bg-gray-900">
				<div className="flex items-center justify-between px-4 py-3.5">
					<div>
						<p className="text-sm font-medium text-white">Sync Collection</p>
						<p className="mt-0.5 text-xs text-white/40">
							{lastSyncedAt
								? `Last synced ${formatRelative(lastSyncedAt)}`
								: "Never synced"}
						</p>
					</div>
					<button
						type="button"
						disabled={isSyncing}
						onClick={handleSync}
						className="flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white transition-opacity active:opacity-70 disabled:opacity-50"
					>
						{isSyncing ? <Spinner /> : <RefreshCw size={16} />}
						{isSyncing ? "Syncing…" : "Sync Now"}
					</button>
				</div>

				{/* Sync error */}
				{error && (
					<>
						<div className="h-px bg-white/10" />
						<p className="px-4 py-3 text-xs text-red-400">{error}</p>
					</>
				)}

				{/* Last sync result — stacked lists */}
				{syncResult && !isSyncing && (
					<>
						{syncResult.pulledMovies.length > 0 && (
							<>
								<div className="h-px bg-white/10" />
								<div className="px-4 py-3">
									<p className="mb-2 text-xs font-semibold text-blue-400">
										↓ Pulled ({syncResult.pulledMovies.length})
									</p>
									<div className="flex flex-col gap-1">
										{syncResult.pulledMovies.map((m) => (
											<p key={m.id} className="text-xs text-white/70">
												{m.title}
											</p>
										))}
									</div>
								</div>
							</>
						)}
						{syncResult.pushedMovies.length > 0 && (
							<>
								<div className="h-px bg-white/10" />
								<div className="px-4 py-3">
									<p className="mb-2 text-xs font-semibold text-green-400">
										↑ Pushed ({syncResult.pushedMovies.length})
									</p>
									<div className="flex flex-col gap-1">
										{syncResult.pushedMovies.map((m) => (
											<p key={m.id} className="text-xs text-white/70">
												{m.title}
											</p>
										))}
									</div>
								</div>
							</>
						)}
						{syncResult.deletedMovies.length > 0 && (
							<>
								<div className="h-px bg-white/10" />
								<div className="px-4 py-3">
									<p className="mb-2 text-xs font-semibold text-red-400">
										✕ Deleted ({syncResult.deletedMovies.length})
									</p>
									<div className="flex flex-col gap-1">
										{syncResult.deletedMovies.map((m) => (
											<p key={m.id} className="text-xs text-white/70">
												{m.title}
											</p>
										))}
									</div>
								</div>
							</>
						)}
						{syncResult.dedupedMovies.length > 0 && (
							<>
								<div className="h-px bg-white/10" />
								<div className="px-4 py-3">
									<p className="mb-2 text-xs font-semibold text-yellow-400">
										~ Deduped ({syncResult.dedupedMovies.length})
									</p>
									<div className="flex flex-col gap-1">
										{syncResult.dedupedMovies.map((m) => (
											<p key={m.id} className="text-xs text-white/70">
												{m.title}
											</p>
										))}
									</div>
								</div>
							</>
						)}
						{!hasAnyResult && (
							<>
								<div className="h-px bg-white/10" />
								<p className="px-4 py-3 text-xs text-white/40">
									Already up to date
								</p>
							</>
						)}
						{syncResult.errors.length > 0 && (
							<>
								<div className="h-px bg-white/10" />
								<div className="flex flex-col gap-1 px-4 py-3">
									<p className="mb-1 text-xs font-semibold text-red-400">
										Errors ({syncResult.errors.length})
									</p>
									{syncResult.errors.map((err) => (
										<p key={err} className="text-xs text-red-400/70">
											{err}
										</p>
									))}
								</div>
							</>
						)}
					</>
				)}
			</div>

			{/* Conflict resolution cards */}
			{conflicts.length > 0 && (
				<div className="flex flex-col gap-3">
					<div className="flex items-center justify-between">
						<h3 className="text-xs font-semibold uppercase tracking-widest text-yellow-400">
							Conflicts ({conflicts.length})
						</h3>
						<ResolveAllButton conflicts={conflicts} />
					</div>
					{conflicts.map((conflict) => (
						<ConflictCard
							key={conflict.id}
							conflict={conflict}
							onResolved={() =>
								showSyncToast(`Resolved: ${conflict.title}`, "success")
							}
						/>
					))}
				</div>
			)}

			{/* Sign out */}
			{/* <div className="rounded-2xl border border-white/10 bg-gray-900">
				<button
					type="button"
					onClick={onLogout}
					className="w-full px-4 py-3.5 text-left text-sm font-medium text-red-400 transition-opacity active:opacity-70"
				>
					Sign Out
				</button>
			</div> */}
		</div>
	);
}

// ─── Main view ───────────────────────────────────────────────────────────────

export function SyncView() {
	const queryClient = useQueryClient();
	const [loginError, setLoginError] = useState<string | null>(null);

	// Auth state is async — use a query so it loads cleanly.
	const { data: isAuthenticated, isLoading } = useQuery({
		queryKey: ["supabase-auth"],
		queryFn: isSupabaseAuthenticated,
	});

	// Auto-login when session is confirmed missing.
	const { mutate: doAutoLogin } = useMutation({
		mutationFn: autoLogin,
		onSuccess: () => {
			setLoginError(null);
			queryClient.setQueryData(["supabase-auth"], true);
		},
		onError: (e) => {
			setLoginError(e instanceof Error ? e.message : "Sign-in failed");
		},
	});

	useEffect(() => {
		if (!isLoading && isAuthenticated === false && !loginError) {
			doAutoLogin();
		}
	}, [isLoading, isAuthenticated, loginError, doAutoLogin]);

	return (
		<div className="flex h-full flex-col overflow-y-auto bg-gray-950 text-white">
			{/* Header */}
			<div className="border-b border-white/10 p-4">
				<h1 className="text-lg font-semibold">Sync</h1>
			</div>

			<div className="flex flex-col gap-6 p-4">
				{!isAuthenticated || isLoading ? (
					<SigningInState error={loginError} />
				) : (
					<section className="flex flex-col gap-3">
						<h2 className="text-xs font-semibold uppercase tracking-widest text-white/40">
							Supabase Sync
						</h2>
						<SyncControls />
					</section>
				)}
			</div>
		</div>
	);
}
