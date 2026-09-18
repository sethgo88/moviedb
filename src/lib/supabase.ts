import { createClient } from "@supabase/supabase-js";
import { fetch as tauriFetch } from "@tauri-apps/plugin-http";
import type { Database } from "./database.types";

// ─── Hardcoded credentials (single-user app) ────────────────────────────────
// URL and anon key are safe to commit — RLS enforces row-level security.
// Password lives in .env.local (gitignored via *.local in .gitignore).
const SUPABASE_URL = "http://100.85.209.13:8000";
const SUPABASE_ANON_KEY =
	"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNzg5Njc1MTY5LCJleHAiOjE5NDczNTUxNjl9._7kXzTsI2KNfy8RlPx57zTXZDcdqRf2kUBevOpT3W_A";
const SUPABASE_EMAIL = "seth.oharra@gmail.com";
const SUPABASE_PASSWORD = import.meta.env.VITE_SUPABASE_PASSWORD as string;

type SupabaseClient = ReturnType<typeof createClient<Database>>;

// Route all Supabase requests through Tauri's Rust HTTP client (reqwest)
// to bypass Android WebView's shouldInterceptRequest interception.
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
	const { error } = await supabase.auth.signInWithPassword({
		email: SUPABASE_EMAIL,
		password: SUPABASE_PASSWORD,
	});
	if (error) throw error;
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
			SUPABASE_URL,
			{ method: "HEAD", signal: controller.signal },
		);
		clearTimeout(timer);
		void res; // any HTTP response means the host is reachable
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
