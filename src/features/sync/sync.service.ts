import { getDb } from "../../lib/db";
import { getSupabase } from "../../lib/supabase";
import { cachePosterFromUrl } from "../tmdb/tmdb.service";
import {
	SupabaseMovieRecordSchema,
	SyncResultSchema,
} from "./sync.schema";
import { useSyncStore } from "./sync.store";
import type { SyncConflict, SyncResult } from "./sync.types";

type DbHandle = Awaited<ReturnType<typeof getDb>>;

// Shape of a row returned by tauri-plugin-sql from the local SQLite movies table.
// is_physical / is_digital / is_backed_up are stored as 0/1 — SQLite has no boolean type.
type LocalMovieRow = {
	id: string;
	tmdb_id: number | null;
	title: string;
	year: number | null;
	poster_url: string | null;
	tmdb_rating: number | null;
	personal_rating: number | null;
	status: string;
	format: string;
	is_physical: number;
	is_digital: number;
	is_backed_up: number;
	notes: string | null;
	deleted_at: string | null;
	created_at: string;
	updated_at: string;
	type: string;
	show_id: string | null;
	season_number: number | null;
};

// SQLite has no boolean type — values from SQLite are 0/1 and must be
// converted back when writing to Postgres (which stores proper booleans).
function boolInt(b: boolean): number {
	return b ? 1 : 0;
}

// Convert a local SQLite row to the Supabase record shape (for conflict diffs).
// Custom posters (data: URLs) are stripped since they're local-only.
function localToSupabaseRecord(row: LocalMovieRow): SyncConflict["local"] {
	return SupabaseMovieRecordSchema.parse({
		id: row.id,
		tmdb_id: row.tmdb_id,
		title: row.title,
		year: row.year,
		poster_url: row.poster_url?.startsWith("data:") ? null : row.poster_url,
		tmdb_rating: row.tmdb_rating,
		personal_rating: row.personal_rating,
		status: row.status,
		format: row.format,
		is_physical: Boolean(row.is_physical),
		is_digital: Boolean(row.is_digital),
		is_backed_up: Boolean(row.is_backed_up),
		notes: row.notes,
		deleted_at: row.deleted_at,
		created_at: row.created_at,
		updated_at: row.updated_at,
		type: row.type,
		show_id: row.show_id,
		season_number: row.season_number,
	});
}

async function getPendingDeleteCount(db: DbHandle): Promise<number> {
	const rows = await db.select<{ count: number }[]>(
		"SELECT COUNT(*) as count FROM movies WHERE deleted_at IS NOT NULL",
	);
	return rows[0]?.count ?? 0;
}

async function readLastSyncedAt(db: DbHandle): Promise<string | null> {
	const rows = await db.select<{ last_synced_at: string | null }[]>(
		"SELECT last_synced_at FROM sync_meta LIMIT 1",
	);
	return rows[0]?.last_synced_at ?? null;
}

async function writeLastSyncedAt(db: DbHandle, ts: string): Promise<void> {
	// INSERT OR REPLACE handles both fresh installs (no row yet) and updates.
	await db.execute(
		"INSERT OR REPLACE INTO sync_meta(last_synced_at) VALUES($1)",
		[ts],
	);
}

export async function runSync(): Promise<SyncResult> {
	const { setSyncing, setLastSyncedAt, setError, clearError } =
		useSyncStore.getState();

	clearError();
	useSyncStore.getState().setConflicts([]);
	setSyncing(true);

	// Capture the sync start time before any operations. Used as the pull
	// filter baseline so records pushed during this run are skipped on pull,
	// and written as the new checkpoint at the end.
	const syncStartedAt = new Date().toISOString();

	const errors: string[] = [];
	const pushedMovies: { id: string; title: string }[] = [];
	const pulledMovies: { id: string; title: string }[] = [];
	const deletedMovies: { id: string; title: string }[] = [];
	const dedupedMovies: { id: string; title: string }[] = [];
	const conflicts: SyncConflict[] = [];

	try {
		const supabase = getSupabase();

		const {
			data: { session },
		} = await supabase.auth.getSession();
		if (!session) {
			throw new Error(
				"Not authenticated with Supabase. Please sign in in the Sync tab.",
			);
		}

		const db = await getDb();
		const lastSyncedAt = await readLastSyncedAt(db);

		// --- PENDING DELETES ---
		const pendingCount = await getPendingDeleteCount(db);

		// --- PUSH DELETES ---
		if (pendingCount > 0) {
			const softDeleted = await db.select<{ id: string; title: string }[]>(
				"SELECT id, title FROM movies WHERE deleted_at IS NOT NULL",
			);

			for (const row of softDeleted) {
				try {
					// Supabase uses the SQLite UUID as `id` directly — no lookup needed.
					const { error } = await supabase
						.from("movies")
						.delete()
						.eq("id", row.id);
					if (error) throw error;

					await db.execute("DELETE FROM movies WHERE id = $1", [row.id]);
					deletedMovies.push({ id: row.id, title: row.title });
				} catch (e) {
					const msg = `Failed to delete movie ${row.id}: ${String(e)}`;
					console.error("[sync] delete error:", msg, e);
					errors.push(msg);
				}
			}
		}

		// Fetch all remote rows (id + updated_at) upfront for existence checks,
		// dedup, and conflict detection.
		const { data: remoteMetaRaw, error: remoteMetaError } = await supabase
			.from("movies")
			.select("id, updated_at");
		if (remoteMetaError) throw remoteMetaError;
		// Map<id, updated_at> — used to detect conflicts and for pull dedup.
		// Rows with null updated_at (trigger failure) are excluded so they fall
		// through to a clean push rather than silently missing conflict detection.
		const remoteMeta = new Map<string, string>();
		for (const r of remoteMetaRaw ?? []) {
			if (r.updated_at) remoteMeta.set(r.id as string, r.updated_at as string);
		}

		// --- LOCAL DEDUP ---
		// If the same TMDB title was ever added twice (different UUIDs), the pull
		// dedup treats each as a stray of the other and deletes both remote records
		// every pull cycle, causing an endless push-every-other-sync loop.
		// Fix: before pushing, find (tmdb_id, type, season_number) groups with
		// more than one active local record, keep the most-recently-updated one,
		// and hard-delete the rest from both SQLite and Supabase.
		const dupeGroups = await db.select<
			{ tmdb_id: number; type: string; sn: number }[]
		>(
			`SELECT tmdb_id, type, COALESCE(season_number, -1) AS sn
			 FROM movies
			 WHERE deleted_at IS NULL AND tmdb_id IS NOT NULL
			 GROUP BY tmdb_id, type, COALESCE(season_number, -1)
			 HAVING COUNT(*) > 1`,
		);

		for (const group of dupeGroups) {
			const members = await db.select<
				{ id: string; title: string; updated_at: string }[]
			>(
				`SELECT id, title, updated_at FROM movies
				 WHERE tmdb_id = $1 AND type = $2
				   AND COALESCE(season_number, -1) = $3
				   AND deleted_at IS NULL
				 ORDER BY updated_at DESC, id ASC`,
				[group.tmdb_id, group.type, group.sn],
			);
			// First row is the keeper (latest updated_at); soft-delete the rest
			// so they are picked up by the PUSH DELETES phase in this same sync.
			const [, ...strays] = members;
			for (const stray of strays) {
				const now = new Date().toISOString();
				await db.execute(
					"UPDATE movies SET deleted_at = $1 WHERE id = $2",
					[now, stray.id],
				);
				dedupedMovies.push({ id: stray.id, title: stray.title });
				console.log(
					`[sync] dedup: soft-deleted stray "${stray.title}" (${stray.id})`,
				);
			}
		}

		// --- PUSH LOCAL CHANGES ---
		// Push a row if it is missing from Supabase (never synced) or updated since
		// the last sync. If both local and remote were modified since lastSyncedAt,
		// that is a true conflict — hold the row back for user resolution.
		const localRows = await db.select<LocalMovieRow[]>(
			"SELECT * FROM movies WHERE deleted_at IS NULL",
		);

		// Track pushed and conflicted IDs so the pull step can skip them.
		const pushedIds = new Set<string>();
		const conflictedIds = new Set<string>();

		for (const row of localRows) {
			const remoteUpdatedAt = remoteMeta.get(row.id);
			const isInRemote = remoteUpdatedAt !== undefined;
			// On first sync (lastSyncedAt null) only push NEW records (not in remote).
			// Remote-existing rows are left for the pull phase — this prevents a
			// fresh install from overwriting cloud data with stale local state.
			const localModified = !!lastSyncedAt && row.updated_at > lastSyncedAt;

			if (!isInRemote || localModified) {
				// Conflict: both sides modified since last sync.
				// Hold back — the user will resolve via the conflict card in SyncView.
				if (
					isInRemote &&
					lastSyncedAt &&
					row.updated_at > lastSyncedAt &&
					remoteUpdatedAt > lastSyncedAt
				) {
					try {
						const { data: remoteRaw, error: fetchErr } = await supabase
							.from("movies")
							.select("*")
							.eq("id", row.id)
							.single();
						if (fetchErr) throw fetchErr;
						const remoteRecord = SupabaseMovieRecordSchema.parse(remoteRaw);
						conflicts.push({
							id: row.id,
							title: row.title,
							local: localToSupabaseRecord(row),
							remote: remoteRecord,
						});
						conflictedIds.add(row.id);
					} catch (e) {
						const msg = `Conflict detection failed for "${row.title}": ${String(e)}`;
						console.error("[sync] conflict error:", msg, e);
						errors.push(msg);
					}
					continue; // skip push — let user decide
				}

				// Clean push: local is ahead or record is new.
				try {
					// Custom posters are base64 data URLs — too large for Supabase
					// and local-only by design. Only sync TMDB HTTPS URLs.
					const posterUrl = row.poster_url?.startsWith("data:")
						? null
						: row.poster_url;

					const payload = {
						id: row.id,
						tmdb_id: row.tmdb_id,
						title: row.title,
						year: row.year,
						poster_url: posterUrl,
						tmdb_rating: row.tmdb_rating,
						personal_rating: row.personal_rating,
						status: row.status,
						format: row.format,
						// SQLite stores booleans as 0/1; Postgres needs actual booleans.
						is_physical: Boolean(row.is_physical),
						is_digital: Boolean(row.is_digital),
						is_backed_up: Boolean(row.is_backed_up),
						notes: row.notes,
						deleted_at: row.deleted_at,
						created_at: row.created_at,
						// Sync exception: we explicitly carry the SQLite updated_at across
						// to preserve last-write-wins semantics across devices. The Postgres
						// trigger is intentionally overridden here — see sync.md.
						updated_at: row.updated_at,
						type: row.type,
						show_id: row.show_id,
						season_number: row.season_number,
						user_id: session.user.id,
					};

					const { error } = await supabase
						.from("movies")
						.upsert(payload, { onConflict: "id" });
					if (error) throw error;

					pushedIds.add(row.id);
					pushedMovies.push({ id: row.id, title: row.title });
				} catch (e) {
					const msg = `Failed to push movie ${row.id}: ${String(e)}`;
					console.error("[sync] push error:", msg, e);
					errors.push(msg);
				}
			}
		}

		// --- PULL REMOTE CHANGES ---
		// Filter uses lastSyncedAt (not syncStartedAt) to catch any remote
		// changes that predate this sync. Records we just pushed or held back
		// as conflicts are skipped to avoid redundant round-trips.
		// Only pull active records. Deletions are handled by the push-deletes
		// phase above — pulling soft-deleted rows would cause a ping-pong cycle
		// where a remote soft-delete is inserted locally, then re-pushed as a
		// pending delete, then hard-deleted from Supabase, then pulled again.
		let pullQuery = supabase.from("movies").select("*").is("deleted_at", null);
		if (lastSyncedAt) {
			pullQuery = pullQuery.gte("updated_at", lastSyncedAt);
		}
		const { data: remoteRecordsRaw, error: pullError } = await pullQuery;
		if (pullError) throw pullError;

		for (const record of remoteRecordsRaw ?? []) {
			try {
				const validated = SupabaseMovieRecordSchema.parse(record);

				if (pushedIds.has(validated.id) || conflictedIds.has(validated.id))
					continue;

				// Dedup: if a local row with a DIFFERENT id already represents this
				// same TMDB content, the incoming record is a stray duplicate.
				// Keep local, delete the duplicate from Supabase, skip insert.
				if (validated.tmdb_id) {
					let dupeQuery: string;
					let dupeParams: unknown[];

					if (
						validated.type === "TV_SEASON" &&
						validated.season_number != null
					) {
						dupeQuery =
							"SELECT id FROM movies WHERE tmdb_id = $1 AND season_number = $2 AND type = 'TV_SEASON' AND id != $3 AND deleted_at IS NULL LIMIT 1";
						dupeParams = [
							validated.tmdb_id,
							validated.season_number,
							validated.id,
						];
					} else {
						dupeQuery =
							"SELECT id FROM movies WHERE tmdb_id = $1 AND type = $2 AND id != $3 AND deleted_at IS NULL LIMIT 1";
						dupeParams = [validated.tmdb_id, validated.type, validated.id];
					}

					const dupeRows = await db.select<{ id: string }[]>(
						dupeQuery,
						dupeParams,
					);
					if (dupeRows.length > 0) {
						try {
							await supabase
									.from("movies")
									.delete()
									.eq("id", validated.id);
						} catch {
							// best-effort — stray record may already be gone
						}
						continue;
					}
				}

				// If the remote poster is a TMDB URL, cache it locally via Rust
				// before inserting so the WebView can display it without CORS issues.
				let posterUrl = validated.poster_url;
				if (
					posterUrl?.startsWith("https://image.tmdb.org") &&
					validated.tmdb_id
				) {
					try {
						posterUrl = await cachePosterFromUrl(validated.tmdb_id, posterUrl);
					} catch {
						// keep the TMDB URL if caching fails — better than losing it
					}
				}

				// INSERT OR REPLACE bypasses the updated_at trigger so we
				// preserve the remote timestamp exactly as received.
				// COALESCE for poster_url: if remote is null (custom poster was
				// stripped before push), keep whatever is stored locally.
				await db.execute(
					`INSERT OR REPLACE INTO movies (
						id, tmdb_id, title, year, poster_url, tmdb_rating,
						personal_rating, status, format, is_physical, is_digital,
						is_backed_up, notes, deleted_at, created_at, updated_at,
						type, show_id, season_number
					) VALUES (
						$1, $2, $3, $4, COALESCE($5, (SELECT poster_url FROM movies WHERE id = $1)), $6,
						$7, $8, $9, $10, $11,
						$12, $13, $14, $15, $16,
						$17, $18, $19
					)`,
					[
						validated.id,
						validated.tmdb_id,
						validated.title,
						validated.year,
						posterUrl,
						validated.tmdb_rating,
						validated.personal_rating,
						validated.status,
						validated.format,
						// Postgres booleans → SQLite 0/1
						boolInt(validated.is_physical),
						boolInt(validated.is_digital),
						boolInt(validated.is_backed_up),
						validated.notes,
						validated.deleted_at,
						validated.created_at,
						validated.updated_at,
						validated.type,
						validated.show_id,
						validated.season_number,
					],
				);
				pulledMovies.push({ id: validated.id, title: validated.title });
			} catch (e) {
				const msg = `Failed to pull record ${record.id}: ${String(e)}`;
				console.error("[sync] pull error:", msg, e);
				errors.push(msg);
			}
		}

		// --- UPDATE CHECKPOINT ---
		await writeLastSyncedAt(db, syncStartedAt);
		setLastSyncedAt(syncStartedAt);

		return SyncResultSchema.parse({
			pushedMovies,
			pulledMovies,
			deletedMovies,
			dedupedMovies,
			conflicts,
			errors,
		});
	} catch (e) {
		const msg = e instanceof Error ? e.message : String(e);
		setError(msg);
		throw e;
	} finally {
		setSyncing(false);
	}
}

// Resolve a conflict detected during sync. The winner's version becomes
// canonical — local version is pushed to Supabase, or remote version
// is written into local SQLite.
export async function resolveConflict(
	conflict: SyncConflict,
	winner: "local" | "remote",
): Promise<void> {
	const supabase = getSupabase();
	const db = await getDb();

	if (winner === "local") {
		// Bump updated_at so this record wins future LWW comparisons, then push.
		// Sync exception: app layer sets updated_at here — see sync.md for rationale.
		// Use toISOString() (not datetime('now')) to keep the format consistent.
		const bumpedAt = new Date().toISOString();
		await db.execute(
			"UPDATE movies SET updated_at = $1 WHERE id = $2",
			[bumpedAt, conflict.id],
		);
		const [updatedRow] = await db.select<LocalMovieRow[]>(
			"SELECT * FROM movies WHERE id = $1",
			[conflict.id],
		);
		if (!updatedRow) throw new Error(`Movie ${conflict.id} not found locally`);

		const {
			data: { session },
		} = await supabase.auth.getSession();
		if (!session) throw new Error("Not authenticated");

		const posterUrl = updatedRow.poster_url?.startsWith("data:")
			? null
			: updatedRow.poster_url;

		const { error } = await supabase.from("movies").upsert(
			{
				id: updatedRow.id,
				tmdb_id: updatedRow.tmdb_id,
				title: updatedRow.title,
				year: updatedRow.year,
				poster_url: posterUrl,
				tmdb_rating: updatedRow.tmdb_rating,
				personal_rating: updatedRow.personal_rating,
				status: updatedRow.status,
				format: updatedRow.format,
				is_physical: Boolean(updatedRow.is_physical),
				is_digital: Boolean(updatedRow.is_digital),
				is_backed_up: Boolean(updatedRow.is_backed_up),
				notes: updatedRow.notes,
				deleted_at: updatedRow.deleted_at,
				created_at: updatedRow.created_at,
				updated_at: updatedRow.updated_at,
				type: updatedRow.type,
				show_id: updatedRow.show_id,
				season_number: updatedRow.season_number,
				user_id: session.user.id,
			},
			{ onConflict: "id" },
		);
		if (error) throw error;
	} else {
		// winner === "remote": write the remote version into local SQLite.
		let posterUrl = conflict.remote.poster_url;
		if (
			posterUrl?.startsWith("https://image.tmdb.org") &&
			conflict.remote.tmdb_id
		) {
			try {
				posterUrl = await cachePosterFromUrl(
					conflict.remote.tmdb_id,
					posterUrl,
				);
			} catch {
				// keep URL if caching fails — better than losing it
			}
		}
		await db.execute(
			`INSERT OR REPLACE INTO movies (
				id, tmdb_id, title, year, poster_url, tmdb_rating,
				personal_rating, status, format, is_physical, is_digital,
				is_backed_up, notes, deleted_at, created_at, updated_at,
				type, show_id, season_number
			) VALUES (
				$1, $2, $3, $4, COALESCE($5, (SELECT poster_url FROM movies WHERE id = $1)), $6,
				$7, $8, $9, $10, $11,
				$12, $13, $14, $15, $16,
				$17, $18, $19
			)`,
			[
				conflict.remote.id,
				conflict.remote.tmdb_id,
				conflict.remote.title,
				conflict.remote.year,
				posterUrl,
				conflict.remote.tmdb_rating,
				conflict.remote.personal_rating,
				conflict.remote.status,
				conflict.remote.format,
				boolInt(conflict.remote.is_physical),
				boolInt(conflict.remote.is_digital),
				boolInt(conflict.remote.is_backed_up),
				conflict.remote.notes,
				conflict.remote.deleted_at,
				conflict.remote.created_at,
				conflict.remote.updated_at,
				conflict.remote.type,
				conflict.remote.show_id,
				conflict.remote.season_number,
			],
		);
	}
}
