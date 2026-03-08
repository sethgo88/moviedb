import { useRouterState } from "@tanstack/react-router";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { useEffect } from "react";
import { router } from "../router";

/**
 * Intercepts the Android hardware back button.
 * - If there is history to go back to, navigate back.
 * - If we are at the root route ("/"), close the app.
 *
 * Note: Tauri 2 fires the "back_button" event from the Android runtime.
 * Verify the event name on device if back button is not responding.
 */
export function useAndroidBackButton() {
	const pathname = useRouterState({ select: (s) => s.location.pathname });

	useEffect(() => {
		const unlisten = listen("back_button", () => {
			if (pathname === "/") {
				getCurrentWindow().close();
			} else {
				router.history.back();
			}
		});

		return () => {
			unlisten.then((fn) => fn());
		};
	}, [pathname]);
}
