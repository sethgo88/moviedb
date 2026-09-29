import { createClient } from "@supabase/supabase-js";
import { fetch as tauriFetch } from "@tauri-apps/plugin-http";
import type { Database } from "./database.types";

// ─── Hardcoded credentials (single-user app) ────────────────────────────────
// URLs and anon key are safe to commit — RLS enforces row-level security.
// Password lives in .env.local (gitignored via *.local in .gitignore).
const LOCAL_URL_DEFAULT = "http://192.168.0.172:8100";
const TAILSCALE_URL_DEFAULT = "http://100.85.209.13:8100";
const SUPABASE_ANON_KEY =
	"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNzkwMDQ3NTIzLCJleHAiOjI1MjQ2MDgwMDB9.QLwx0Z4dttScDehBGtYAqlFMDEe2NjiQJCjG5bIsFmI";
const SUPABASE_EMAIL = "seth.oharra@gmail.com";
// Fail loudly at startup if the env var is missing rather than silently sending
// the string "undefined" as the password.
const SUPABASE_PASSWORD: string = (() => {
	const v = import.meta.env.VITE_SUPABASE_PASSWORD;
	if (!v) throw new Error("VITE_SUPABASE_PASSWORD is not set — check .env.local");
	return v;
})();

const LOCAL_URL_KEY = "supabase_local_url";
const TAILSCALE_URL_KEY = "supabase_tailscale_url";

// Wrap tauriFetch so non-JSON error responses (e.g. Kong returning plain-text
// "Unauthorized" on a bad API key) are converted to JSON before the Supabase
// JS client tries to parse them. Without this, tauriFetch throws a
// ReadableStreamDefaultController error that masks the real failure.
const httpFetch: typeof globalThis.fetch = async (input, init) => {
	const response = await (tauriFetch as unknown as typeof globalThis.fetch)(
		input,
		init,
	);
	if (!response.ok) {
		const ct = response.headers.get("content-type") ?? "";
		if (!ct.includes("application/json")) {
			const text = await response.text().catch(() => "Unknown error");
			console.warn("[supabase] non-JSON error response:", response.status, text);
			return new Response(JSON.stringify({ message: text, error: text }), {
				status: response.status,
				statusText: response.statusText,
				headers: { "content-type": "application/json" },
			});
		}
	}
	return response;
};

type SupabaseClient = ReturnType<typeof createClient<Database>>;

let supabaseInstance: SupabaseClient | null = null;
// Memoise the in-flight resolution promise so concurrent getSupabase() callers
// don't each run their own pair of 3 s probes.
let resolvePromise: Promise<SupabaseClient> | null = null;

// ─── URL accessors ───────────────────────────────────────────────────────────

export function getLocalUrl(): string {
	return localStorage.getItem(LOCAL_URL_KEY) ?? LOCAL_URL_DEFAULT;
}

export function getTailscaleUrl(): string {
	return localStorage.getItem(TAILSCALE_URL_KEY) ?? TAILSCALE_URL_DEFAULT;
}

export function setLocalUrl(url: string): void {
	const trimmed = url.trim().replace(/\/$/, "");
	if (!trimmed) {
		localStorage.removeItem(LOCAL_URL_KEY);
	} else {
		localStorage.setItem(LOCAL_URL_KEY, trimmed);
	}
	resetSupabase();
}

export function setTailscaleUrl(url: string): void {
	const trimmed = url.trim().replace(/\/$/, "");
	if (!trimmed) {
		localStorage.removeItem(TAILSCALE_URL_KEY);
	} else {
		localStorage.setItem(TAILSCALE_URL_KEY, trimmed);
	}
	resetSupabase();
}

// ─── Connectivity probe ──────────────────────────────────────────────────────

/**
 * Returns true if the given URL is reachable within the timeout.
 * Any HTTP response (including 4xx/5xx) counts as reachable — only network
 * errors and timeouts trigger false.
 */
async function probeUrl(url: string, timeoutMs = 3000): Promise<boolean> {
	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), timeoutMs);
	try {
		await httpFetch(`${url}/auth/v1/health`, {
			method: "HEAD",
			signal: controller.signal,
		});
		return true;
	} catch {
		return false;
	} finally {
		clearTimeout(timer);
	}
}

export class SupabaseUnreachableError extends Error {
	constructor() {
		super(
			"Cannot reach server. Check your network or update the URLs in Settings.",
		);
		this.name = "SupabaseUnreachableError";
	}
}

async function resolveSupabaseUrl(): Promise<string> {
	const localUrl = getLocalUrl();
	if (await probeUrl(localUrl)) return localUrl;
	const tailscaleUrl = getTailscaleUrl();
	if (await probeUrl(tailscaleUrl)) return tailscaleUrl;
	throw new SupabaseUnreachableError();
}

// ─── Client singleton ────────────────────────────────────────────────────────

/** Discard the cached client so the next getSupabase() call re-probes URLs. */
export function resetSupabase(): void {
	// Stop the GoTrueClient's background refresh timer before discarding so
	// it doesn't keep firing 401s from backgrounded sessions.
	supabaseInstance?.auth.stopAutoRefresh();
	supabaseInstance = null;
	resolvePromise = null;
}

function buildClient(url: string): SupabaseClient {
	return createClient<Database>(url, SUPABASE_ANON_KEY, {
		global: { fetch: httpFetch },
	});
}

/**
 * Returns the Supabase client, probing local → Tailscale to pick the right URL.
 * Throws SupabaseUnreachableError if neither URL responds.
 * Call resetSupabase() before this to force a fresh probe (done automatically
 * at the start of each runSync()).
 */
export async function getSupabase(): Promise<SupabaseClient> {
	if (supabaseInstance) return supabaseInstance;
	if (!resolvePromise) {
		resolvePromise = resolveSupabaseUrl().then((url) => {
			supabaseInstance = buildClient(url);
			resolvePromise = null;
			return supabaseInstance;
		});
	}
	return resolvePromise;
}

// ─── Auth helpers ────────────────────────────────────────────────────────────

/** Sign in using hardcoded credentials. Throws on failure. */
export async function autoLogin(): Promise<void> {
	console.log("[auth] autoLogin — calling signInWithPassword");
	try {
		const { data, error } = await (await getSupabase()).auth.signInWithPassword({
			email: SUPABASE_EMAIL,
			password: SUPABASE_PASSWORD,
		});
		console.log("[auth] signInWithPassword result:", {
			hasSession: !!data?.session,
			errorMsg: error?.message,
			errorCode: (error as { code?: string } | null)?.code,
		});
		if (error) throw error;
	} catch (e) {
		console.error("[auth] autoLogin threw:", e instanceof Error ? e.message : String(e));
		throw e;
	}
}

/** Authenticate with email + password. Throws on failure. */
export async function loginSupabase(
	email: string,
	password: string,
): Promise<void> {
	const { error } = await (await getSupabase()).auth.signInWithPassword({
		email,
		password,
	});
	if (error) throw error;
}

/** Clear the auth session. */
export async function logoutSupabase(): Promise<void> {
	await (await getSupabase()).auth.signOut();
}

/**
 * Returns true if either URL is reachable.
 * Used by useTailscaleConnectivity to drive the connection banner.
 */
export async function checkTailscaleConnectivity(): Promise<boolean> {
	if (await probeUrl(getLocalUrl())) return true;
	return probeUrl(getTailscaleUrl());
}

/** True if there is an active session. */
export async function isSupabaseAuthenticated(): Promise<boolean> {
	const { data } = await (await getSupabase()).auth.getSession();
	return data.session !== null;
}
