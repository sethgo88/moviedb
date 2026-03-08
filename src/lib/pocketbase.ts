import PocketBase from "pocketbase";

export const POCKETBASE_URL_KEY = "pocketbase_url";

let instance: PocketBase | null = null;

export function getPb(): PocketBase {
	if (instance === null) {
		const url = localStorage.getItem(POCKETBASE_URL_KEY) ?? "";
		instance = new PocketBase(url);
	}
	return instance;
}

export function configurePb(url: string): void {
	localStorage.setItem(POCKETBASE_URL_KEY, url);
	instance = new PocketBase(url);
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
