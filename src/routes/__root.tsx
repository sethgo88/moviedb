import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createRootRoute, Outlet } from "@tanstack/react-router";
import { useAndroidBackButton } from "../hooks/useAndroidBackButton";

const queryClient = new QueryClient();

function RootLayout() {
	useAndroidBackButton();

	return (
		<QueryClientProvider client={queryClient}>
			<div
				className="flex h-screen flex-col"
				style={{
					paddingTop: "env(safe-area-inset-top)",
					paddingBottom: "env(safe-area-inset-bottom)",
				}}
			>
				<Outlet />
			</div>
		</QueryClientProvider>
	);
}

export const rootRoute = createRootRoute({
	component: RootLayout,
});
