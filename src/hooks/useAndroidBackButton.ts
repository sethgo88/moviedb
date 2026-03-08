import { onBackButtonPress } from "@tauri-apps/api/app";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { useEffect } from "react";
import { tryInterceptBack } from "../lib/back-interceptor";
import { router } from "../router";

/**
 * Intercepts the Android hardware back button via Tauri 2's
 * onBackButtonPress API (app plugin).
 * - Checks tryInterceptBack() first — if a component (e.g. dirty MovieForm)
 *   has registered an interceptor it will handle the event and return true.
 * - Otherwise: navigates back in history, or closes the app from root.
 */
export function useAndroidBackButton() {
	useEffect(() => {
		let unregister: (() => void) | undefined;

		onBackButtonPress(() => {
			if (tryInterceptBack()) return;
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
