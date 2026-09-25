import { createClient } from "@supabase/supabase-js";
import { fetch as tauriFetch } from "@tauri-apps/plugin-http";
import type { Database } from "./database.types";

// ─── Hardcoded credentials (single-user app) ────────────────────────────────
// URL and anon key are safe to commit — RLS enforces row-level security.
// Password lives in .env.local (gitignored via *.local in .gitignore).
const SUPABASE_URL = "http://100.85.209.13:8100";
const SUPABASE_ANON_KEY =
	"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNzkwMDQ3NTIzLCJleHAiOjI1MjQ2MDgwMDB9.QLwx0Z4dttScDehBGtYAqlFMDEe2NjiQJCjG5bIsFmI";
const SUPABASE_EMAIL = "seth.oharra@gmail.com";
const SUPABASE_PASSWORD = import.meta.env.VITE_SUPABASE_PASSWORD as string;

type SupabaseClient = ReturnType<typeof createClient<Database>>;

// Android HTTP bypass: route ALL Supabase requests through Tauri's Rust HTTP
// client so they can reach the Tailscale IP. Without this the Android WebView's
// network stack is used, which cannot resolve/route to 100.85.x.x Tailscale IPs.
const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
	global: { fetch: tauriFetch as unknown as typeof globalThis.fetch },
});

export function getSupabase(): SupabaseClient {
	return supabase;
}

/** Always true — credentials are hardcoded. */
export function isSupabaseConfigured(): boolean {
	return true;
}

/** Sign in using hardcoded credentials. Throws on failure. */
export async function autoLogin(): Promise<void> {
	console.log("[supabase] autoLogin: attempting signInWithPassword to", SUPABASE_URL);
	const { error } = await supabase.auth.signInWithPassword({
		email: SUPABASE_EMAIL,
		password: SUPABASE_PASSWORD,
	});
	if (error) {
		console.error("[supabase] autoLogin failed:", error.message, error);
		throw error;
	}
	console.log("[supabase] autoLogin: success");
}

/** Authenticate with email + password. Throws on failure. */
export async function loginSupabase(
	email: string,
	password: string,
): Promise<void> {
	const { error } = await supabase.auth.signInWithPassword({
		email,
		password,
	});
	if (error) throw error;
}

/** Clear the auth session. */
export async function logoutSupabase(): Promise<void> {
	await supabase.auth.signOut();
}

/**
 * Returns true if the Supabase host is reachable (i.e. Tailscale is connected).
 * Uses a 3s timeout HEAD request — any HTTP response counts as reachable.
 */
export async function checkTailscaleConnectivity(): Promise<boolean> {
	try {
		const controller = new AbortController();
		const timer = setTimeout(() => controller.abort(), 3000);
		const res = await (tauriFetch as unknown as typeof globalThis.fetch)(
			`${SUPABASE_URL}/rest/v1/`,
			{
				method: "GET",
				headers: {
					apikey: SUPABASE_ANON_KEY,
					Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
				},
				signal: controller.signal,
			},
		);
		clearTimeout(timer);
		void res; // any HTTP response (even 401/403) means the server is up
		return true;
	} catch {
		return false;
	}
}

/** True if there is an active session. */
export async function isSupabaseAuthenticated(): Promise<boolean> {
	const { data } = await supabase.auth.getSession();
	return data.session !== null;
}
