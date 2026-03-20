import { fetch as tauriFetch } from "@tauri-apps/plugin-http";
import PocketBase from "pocketbase";

export const POCKETBASE_URL_KEY = "pocketbase_url";

let instance: PocketBase | null = null;

function makePb(url: string): PocketBase {
	const pb = new PocketBase(url);
	// On Android, WebView's shouldInterceptRequest intercepts fetch() calls and
	// can return a probe response instead of forwarding the real request. Route
	// only PocketBase through Tauri's Rust HTTP client (reqwest) to bypass it.
	// Injected via beforeSend so only PocketBase requests are affected — other
	// fetch callers (e.g. TMDB) continue using the native WebView fetch.
	pb.beforeSend = (reqUrl, options) => {
		options.fetch = tauriFetch as unknown as typeof globalThis.fetch;
		return { url: reqUrl, options };
	};
	return pb;
}

export function getPb(): PocketBase {
	if (instance === null) {
		const url = localStorage.getItem(POCKETBASE_URL_KEY) ?? "";
		instance = makePb(url);
	}
	return instance;
}

export function configurePb(url: string): void {
	localStorage.setItem(POCKETBASE_URL_KEY, url);
	instance = makePb(url);
}

/** True if a server URL has been saved in Settings. */
export function isPbConfigured(): boolean {
	return Boolean(localStorage.getItem(POCKETBASE_URL_KEY));
}

/** True if the current auth token is present and not expired. */
export function isPbAuthenticated(): boolean {
	return getPb().authStore.isValid;
}

/** Authenticate with email + password. Throws on failure. */
export async function loginPb(email: string, password: string): Promise<void> {
	await getPb().collection("users").authWithPassword(email, password);
}

/** Clear the auth token. */
export function logoutPb(): void {
	getPb().authStore.clear();
}
