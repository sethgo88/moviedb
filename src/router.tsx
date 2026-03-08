import {
	createMemoryHistory,
	createRoute,
	createRouter,
} from "@tanstack/react-router";
import { rootRoute } from "./routes/__root";
import { AddMovieView } from "./views/AddMovieView";
import { CollectionView } from "./views/CollectionView";
import { EditMovieView } from "./views/EditMovieView";
import { MovieDetailView } from "./views/MovieDetailView";
import { SettingsView } from "./views/SettingsView";

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
	component: MovieDetailView,
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

const routeTree = rootRoute.addChildren([
	indexRoute,
	addMovieRoute,
	movieDetailRoute,
	editMovieRoute,
	settingsRoute,
]);

const memoryHistory = createMemoryHistory({ initialEntries: ["/"] });

export const router = createRouter({ routeTree, history: memoryHistory });

declare module "@tanstack/react-router" {
	interface Register {
		router: typeof router;
	}
}
