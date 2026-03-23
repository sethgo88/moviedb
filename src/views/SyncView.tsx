import { useMutation } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { RefreshCw } from "lucide-react";
import { useState } from "react";
import { Button } from "../components/atoms/Button/button";
import { Spinner } from "../components/atoms/Spinner/spinner";
import { Toast } from "../components/atoms/Toast/toast";
import { ConfirmSheet } from "../components/molecules/ConfirmSheet/confirm-sheet";
import {
	usePendingDeleteCount,
	useRunSync,
} from "../features/sync/sync.queries";
import { useSyncStore } from "../features/sync/sync.store";
import {
	isPbAuthenticated,
	isPbConfigured,
	loginPb,
	logoutPb,
} from "../lib/pocketbase";

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

// ─── Sub-views ───────────────────────────────────────────────────────────────

function NotConfiguredState() {
	const navigate = useNavigate();
	return (
		<div className="flex flex-col items-center gap-4 py-20 text-center">
			<RefreshCw size={40} className="text-white/20" />
			<p className="text-white/60">No sync server configured.</p>
			<Button onClick={() => navigate({ to: "/settings" })}>
				Go to Settings
			</Button>
		</div>
	);
}

function LoginForm({ onSuccess }: { onSuccess: () => void }) {
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const {
		mutate: login,
		isPending: isLoading,
		error: loginError,
	} = useMutation({
		mutationFn: ({ em, pw }: { em: string; pw: string }) => loginPb(em, pw),
		onSuccess,
	});
	const error =
		loginError instanceof Error
			? loginError.message
			: loginError
				? "Login failed. Check your credentials."
				: null;

	function handleLogin() {
		if (!email.trim() || !password) return;
		login({ em: email.trim(), pw: password });
	}

	return (
		<div className="rounded-2xl border border-white/10 bg-gray-900 p-4">
			<p className="mb-4 text-sm text-white/50">
				Sign in to your PocketBase instance to enable sync.
			</p>

			<div className="flex flex-col gap-3">
				<input
					type="email"
					placeholder="Email"
					value={email}
					autoComplete="email"
					onChange={(e) => setEmail(e.target.value)}
					className="rounded-lg border border-white/10 bg-gray-800 px-3 py-2.5 text-sm text-white placeholder-white/30 outline-none transition-colors focus:border-blue-500"
				/>
				<input
					type="password"
					placeholder="Password"
					value={password}
					autoComplete="current-password"
					onChange={(e) => setPassword(e.target.value)}
					onKeyDown={(e) => e.key === "Enter" && handleLogin()}
					className="rounded-lg border border-white/10 bg-gray-800 px-3 py-2.5 text-sm text-white placeholder-white/30 outline-none transition-colors focus:border-blue-500"
				/>
				{error && <p className="text-xs text-red-400">{error}</p>}
				<button
					type="button"
					disabled={isLoading || !email.trim() || !password}
					onClick={handleLogin}
					className="rounded-lg bg-blue-600 py-2.5 text-sm font-semibold text-white transition-opacity active:opacity-70 disabled:opacity-40"
				>
					{isLoading ? "Signing in…" : "Sign In"}
				</button>
			</div>
		</div>
	);
}

function SyncControls({ onLogout }: { onLogout: () => void }) {
	const { isSyncing, lastSyncedAt, error } = useSyncStore();
	const { data: pendingDeletes = 0 } = usePendingDeleteCount();
	const { mutate: runSync, data: syncResult } = useRunSync();
	const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
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

	function handleSync() {
		if (pendingDeletes > 0) {
			setShowDeleteConfirm(true);
			return;
		}
		runSync(false, {
			onSuccess: (result) => {
				const total =
					result.pushedMovies.length +
					result.pulledMovies.length +
					result.deletedMovies.length +
					result.dedupedMovies.length;
				showToast(
					total > 0
						? `Synced ${total} item${total === 1 ? "" : "s"}`
						: "Already up to date",
				);
			},
			onError: (e) => {
				showToast(e instanceof Error ? e.message : "Sync failed", "error");
			},
		});
	}

	function handleSyncWithDeletes() {
		setShowDeleteConfirm(false);
		runSync(true, {
			onSuccess: (result) => {
				const total =
					result.pushedMovies.length +
					result.pulledMovies.length +
					result.deletedMovies.length +
					result.dedupedMovies.length;
				showToast(
					total > 0
						? `Synced ${total} item${total === 1 ? "" : "s"}`
						: "Already up to date",
				);
			},
			onError: (e) => {
				showToast(e instanceof Error ? e.message : "Sync failed", "error");
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
			<Toast
				message={toast?.message ?? ""}
				visible={toast !== null}
				variant={toast?.variant}
			/>

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

				{/* Pending deletes warning */}
				{pendingDeletes > 0 && (
					<>
						<div className="h-px bg-white/10" />
						<div className="flex items-center gap-3 px-4 py-3">
							<div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-yellow-500/20 text-xs font-bold text-yellow-400">
								{pendingDeletes}
							</div>
							<p className="text-xs text-yellow-400">
								{pendingDeletes === 1
									? "1 movie pending deletion"
									: `${pendingDeletes} movies pending deletion`}{" "}
								— will be confirmed on next sync.
							</p>
						</div>
					</>
				)}

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

			{/* Sign out */}
			<div className="rounded-2xl border border-white/10 bg-gray-900">
				<button
					type="button"
					onClick={onLogout}
					className="w-full px-4 py-3.5 text-left text-sm font-medium text-red-400 transition-opacity active:opacity-70"
				>
					Sign Out
				</button>
			</div>

			{/* Pending deletes confirm */}
			<ConfirmSheet
				isOpen={showDeleteConfirm}
				title="Pending Deletions"
				message={`You have ${pendingDeletes} movie${pendingDeletes === 1 ? "" : "s"} queued for deletion. Syncing will permanently remove ${pendingDeletes === 1 ? "it" : "them"} from PocketBase. Continue?`}
				confirmLabel="Sync & Delete"
				isDangerous
				onConfirm={handleSyncWithDeletes}
				onCancel={() => setShowDeleteConfirm(false)}
			/>
		</div>
	);
}

// ─── Main view ───────────────────────────────────────────────────────────────

export function SyncView() {
	// Local state tracks auth so the view re-renders after login/logout
	// without requiring a full app reload.
	const [isAuthenticated, setIsAuthenticated] = useState(isPbAuthenticated);
	const configured = isPbConfigured();

	function handleLogout() {
		logoutPb();
		setIsAuthenticated(false);
	}

	return (
		<div className="flex h-full flex-col overflow-y-auto bg-gray-950 text-white">
			{/* Header */}
			<div className="border-b border-white/10 p-4">
				<h1 className="text-lg font-semibold">Sync</h1>
			</div>

			<div className="flex flex-col gap-6 p-4">
				{!configured ? (
					<NotConfiguredState />
				) : !isAuthenticated ? (
					<section className="flex flex-col gap-3">
						<h2 className="text-xs font-semibold uppercase tracking-widest text-white/40">
							PocketBase Sign In
						</h2>
						<LoginForm onSuccess={() => setIsAuthenticated(true)} />
					</section>
				) : (
					<section className="flex flex-col gap-3">
						<h2 className="text-xs font-semibold uppercase tracking-widest text-white/40">
							PocketBase Sync
						</h2>
						<SyncControls onLogout={handleLogout} />
					</section>
				)}
			</div>
		</div>
	);
}
