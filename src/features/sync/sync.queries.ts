import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { movieKeys } from "../movies/movies.queries";
import { getPendingDeleteCount, runSync } from "./sync.service";

export const syncKeys = {
	pendingDeletes: ["sync", "pendingDeletes"] as const,
};

export function usePendingDeleteCount() {
	return useQuery({
		queryKey: syncKeys.pendingDeletes,
		queryFn: getPendingDeleteCount,
	});
}

export function useRunSync() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (skipDeleteConfirmation: boolean | undefined) =>
			runSync(skipDeleteConfirmation ?? false),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: movieKeys.all });
			queryClient.invalidateQueries({ queryKey: syncKeys.pendingDeletes });
		},
	});
}
