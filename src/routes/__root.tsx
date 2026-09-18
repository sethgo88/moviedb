import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createRootRoute, Outlet } from "@tanstack/react-router";
import { WifiOff } from "lucide-react";
import { Toast } from "../components/atoms/Toast/toast";
import { NavBar } from "../components/organisms/NavBar/nav-bar";
import { useSyncStore } from "../features/sync/sync.store";
import { useAndroidBackButton } from "../hooks/useAndroidBackButton";
import { useAutoSync } from "../hooks/useAutoSync";
import { useTailscaleConnectivity } from "../hooks/useTailscaleConnectivity";

const queryClient = new QueryClient();

function AppShell() {
	useAndroidBackButton();
	useAutoSync();

	const syncToast = useSyncStore((s) => s.syncToast);
	const isConnected = useTailscaleConnectivity();

	return (
		<div
			className="flex h-screen flex-col"
			style={{ paddingTop: "env(safe-area-inset-top)" }}
		>
			<Toast
				message={syncToast?.message ?? ""}
				visible={syncToast !== null}
				variant={syncToast?.variant}
			/>
			{!isConnected && (
				<div className="flex items-center justify-center gap-1.5 bg-yellow-500/15 px-4 py-1.5">
					<WifiOff size={12} className="shrink-0 text-yellow-400" />
					<p className="text-xs font-medium text-yellow-400">
						Not connected to Tailscale — sync unavailable
					</p>
				</div>
			)}
			<div className="flex-1 overflow-hidden">
				<Outlet />
			</div>
			<NavBar />
		</div>
	);
}

function RootLayout() {
	return (
		<QueryClientProvider client={queryClient}>
			<AppShell />
		</QueryClientProvider>
	);
}

export const rootRoute = createRootRoute({
	component: RootLayout,
});
