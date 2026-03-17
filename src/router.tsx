import {
	createMemoryHistory,
	createRoute,
	createRouter,
	redirect,
} from "@tanstack/react-router";
import { rootRoute } from "./routes/__root";
import { AddMovieView } from "./views/AddMovieView";
import { CollectionView } from "./views/CollectionView";
import { EditMovieView } from "./views/EditMovieView";
import { ImportView } from "./views/ImportView";
import { SettingsView } from "./views/SettingsView";
import { SyncView } from "./views/SyncView";

const indexRoute = createRoute({
	getParentRoute: () => rootRoute,
	path: "/",
	component: CollectionView,
});

const addMovieRoute = createRoute({
	getParentRoute: () => rootRoute,
	path: "/movie/add",
	component: AddMovieView,
});

const movieDetailRoute = createRoute({
	getParentRoute: () => rootRoute,
	path: "/movie/$id",
	beforeLoad: ({ params }) => {
		throw redirect({ to: "/movie/$id/edit", params });
	},
});

const editMovieRoute = createRoute({
	getParentRoute: () => rootRoute,
	path: "/movie/$id/edit",
	component: EditMovieView,
});

const settingsRoute = createRoute({
	getParentRoute: () => rootRoute,
	path: "/settings",
	component: SettingsView,
});

const syncRoute = createRoute({
	getParentRoute: () => rootRoute,
	path: "/sync",
	component: SyncView,
});

const importRoute = createRoute({
	getParentRoute: () => rootRoute,
	path: "/import",
	component: ImportView,
});

const routeTree = rootRoute.addChildren([
	indexRoute,
	addMovieRoute,
	movieDetailRoute,
	editMovieRoute,
	settingsRoute,
	syncRoute,
	importRoute,
]);

const memoryHistory = createMemoryHistory({ initialEntries: ["/"] });

export const router = createRouter({ routeTree, history: memoryHistory });

declare module "@tanstack/react-router" {
	interface Register {
		router: typeof router;
	}
}
