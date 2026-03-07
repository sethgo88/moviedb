import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
	createMovie,
	getAllMovies,
	getMovieById,
	hardDeleteMovie,
	softDeleteMovie,
	updateMovie,
} from "./movies.service";
import type { NewMovie, UpdateMovie } from "./movies.types";

export const movieKeys = {
	all: ["movies"] as const,
	detail: (id: string) => ["movies", id] as const,
};

export function useMovies() {
	return useQuery({
		queryKey: movieKeys.all,
		queryFn: getAllMovies,
	});
}

export function useMovie(id: string) {
	return useQuery({
		queryKey: movieKeys.detail(id),
		queryFn: () => getMovieById(id),
		enabled: !!id,
	});
}

export function useCreateMovie() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (data: NewMovie) => createMovie(data),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: movieKeys.all });
		},
	});
}

export function useUpdateMovie() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: ({ id, data }: { id: string; data: UpdateMovie }) =>
			updateMovie(id, data),
		onSuccess: (_result, { id }) => {
			queryClient.invalidateQueries({ queryKey: movieKeys.all });
			queryClient.invalidateQueries({ queryKey: movieKeys.detail(id) });
		},
	});
}

export function useSoftDeleteMovie() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (id: string) => softDeleteMovie(id),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: movieKeys.all });
		},
	});
}

export function useHardDeleteMovie() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (id: string) => hardDeleteMovie(id),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: movieKeys.all });
		},
	});
}
