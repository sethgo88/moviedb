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
