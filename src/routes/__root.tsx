import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createRootRoute, Outlet } from "@tanstack/react-router";
import { useAndroidBackButton } from "../hooks/useAndroidBackButton";

const queryClient = new QueryClient();

function RootLayout() {
	useAndroidBackButton();

	return (
		<QueryClientProvider client={queryClient}>
			<Outlet />
		</QueryClientProvider>
	);
}

export const rootRoute = createRootRoute({
	component: RootLayout,
});
