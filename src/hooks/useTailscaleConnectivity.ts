import { useQuery } from "@tanstack/react-query";
import { checkTailscaleConnectivity } from "../lib/supabase";

const POLL_INTERVAL_MS = 30_000;

/**
 * Polls the Supabase host every 30s to determine if Tailscale is connected.
 * Starts optimistically true to avoid a flash of the banner on app launch.
 */
export function useTailscaleConnectivity(): boolean {
	const { data } = useQuery({
		queryKey: ["tailscale-connectivity"],
		queryFn: checkTailscaleConnectivity,
		refetchInterval: POLL_INTERVAL_MS,
		refetchIntervalInBackground: false,
		refetchOnWindowFocus: false,
		initialData: true,
	});
	return data;
}
