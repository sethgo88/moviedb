/// <reference types="vite/client" />

interface ImportMetaEnv {
	readonly VITE_SUPABASE_PASSWORD: string;
	// Fine-grained PAT: contents:write on sethgo88/moviedb-view only.
	// Baked into the bundle at build time — keep scoped narrowly; never distribute the APK.
	readonly VITE_GITHUB_PAT: string;
}

interface ImportMeta {
	readonly env: ImportMetaEnv;
}
