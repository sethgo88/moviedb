import { useMutation, useQueryClient } from "@tanstack/react-query";
import { movieKeys } from "../movies/movies.queries";
import { runSync } from "./sync.service";
import { useSyncStore } from "./sync.store";

export function useRunSync() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: () => runSync(),
		onSuccess: (result) => {
			queryClient.invalidateQueries({ queryKey: movieKeys.all });
			useSyncStore.getState().setConflicts(result.conflicts);
		},
	});
}
