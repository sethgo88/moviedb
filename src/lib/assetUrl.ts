import { convertFileSrc } from "@tauri-apps/api/core";

/**
 * Convert a local file path to a Tauri asset protocol URL safe for use in <img src>.
 *
 * `convertFileSrc` encodes the entire path with encodeURIComponent, which also encodes
 * slashes (/ → %2F). The asset server treats the whole thing as one path segment and
 * returns a 404. This function preserves the protocol/host from convertFileSrc but
 * re-encodes the path with slashes kept intact.
 */
export function localFileToAssetUrl(filePath: string): string {
	const raw = convertFileSrc(filePath);
	const url = new URL(raw);
	// url.pathname is /<percent-encoded-path>. Decode it fully, strip leading slashes,
	// then re-encode each segment without touching the slash separators.
	const decoded = decodeURIComponent(url.pathname).replace(/^\/+/, "");
	const fixedPath = decoded.split("/").map(encodeURIComponent).join("/");
	return `${url.origin}/${fixedPath}`;
}
