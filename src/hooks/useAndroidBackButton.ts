import { onBackButtonPress } from "@tauri-apps/api/app";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { useEffect } from "react";
import { router } from "../router";

/**
 * Intercepts the Android hardware back button via Tauri 2's
 * onBackButtonPress API (app plugin).
 * Navigates back in history, or closes the app from root.
 * Dirty-form guards are handled by the router-level useBlocker in MovieForm.
 */
export function useAndroidBackButton() {
	useEffect(() => {
		let unregister: (() => void) | undefined;

		onBackButtonPress(() => {
			const pathname = router.state.location.pathname;
			if (pathname === "/") {
				getCurrentWindow().close();
			} else {
				router.history.back();
			}
		}).then((listener) => {
			unregister = () => listener.unregister();
		});

		return () => {
			unregister?.();
		};
	}, []);
}
