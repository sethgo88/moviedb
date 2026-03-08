import type Database from "@tauri-apps/plugin-sql";
import { getDb } from "../../lib/db";
import { getPb } from "../../lib/pocketbase";
import { PbMovieRecordSchema, SyncResultSchema } from "./sync.schema";
import { useSyncStore } from "./sync.store";
import type { SyncResult } from "./sync.types";

// Converts JS ISO 8601 ("2024-01-01T10:00:00.000Z") to PocketBase date
// format ("2024-01-01 10:00:00.000Z") required in filter strings.
function toPbDate(iso: string): string {
	return iso.replace("T", " ");
}

// SQLite has no boolean type — PocketBase booleans must be stored as 0/1.
function pbInt(b: boolean): number {
	return b ? 1 : 0;
}

export class PendingDeletesError extends Error {
	constructor(public count: number) {
		super(`${count} pending delete(s) require confirmation before sync`);
		this.name = "PendingDeletesError";
	}
}

export async function getPendingDeleteCount(): Promise<number> {
	const db = await getDb();
	const rows = await db.select<{ count: number }[]>(
		"SELECT COUNT(*) as count FROM movies WHERE deleted_at IS NOT NULL",
	);
	return rows[0]?.count ?? 0;
}

async function readLastSyncedAt(db: Database): Promise<string | null> {
	const rows = await db.select<{ last_synced_at: string | null }[]>(
		"SELECT last_synced_at FROM sync_meta LIMIT 1",
	);
	return rows[0]?.last_synced_at ?? null;
}

async function writeLastSyncedAt(db: Database, ts: string): Promise<void> {
	await db.execute("UPDATE sync_meta SET last_synced_at = $1", [ts]);
}

export async function runSync(
	skipDeleteConfirmation = false,
): Promise<SyncResult> {
	const {
		setSyncing,
		setLastSyncedAt,
		setError,
		clearError,
		setPendingDeletes,
	} = useSyncStore.getState();

	clearError();
	setSyncing(true);

	// Capture the sync start time before any operations. Used as the pull
	// filter baseline so records pushed during this run are skipped on pull,
	// and written as the new checkpoint at the end.
	const syncStartedAt = new Date().toISOString();

	const errors: string[] = [];
	let pushed = 0;
	let pulled = 0;

	try {
		const pb = getPb();

		if (!pb.authStore.isValid) {
			throw new Error(
				"Not authenticated with PocketBase. Please configure your sync server in Settings.",
			);
		}

		const db = await getDb();
		const lastSyncedAt = await readLastSyncedAt(db);

		// --- PENDING DELETES ---
		const pendingCount = await getPendingDeleteCount();
		setPendingDeletes(pendingCount);

		if (pendingCount > 0 && !skipDeleteConfirmation) {
			throw new PendingDeletesError(pendingCount);
		}

		// --- PUSH DELETES ---
		if (pendingCount > 0) {
			const softDeleted = await db.select<{ id: string }[]>(
				"SELECT id FROM movies WHERE deleted_at IS NOT NULL",
			);

			for (const row of softDeleted) {
				try {
					const pbRecord = await pb
						.collection("movies")
						.getFirstListItem(`local_id = "${row.id}"`)
						.catch(() => null);

					if (pbRecord) {
						await pb.collection("movies").delete(pbRecord.id);
					}

					await db.execute("DELETE FROM movies WHERE id = $1", [row.id]);
				} catch (e) {
					errors.push(`Failed to delete movie ${row.id}: ${String(e)}`);
				}
			}
		}

		// --- PUSH LOCAL CHANGES ---
		const localRows = lastSyncedAt
			? await db.select<Record<string, unknown>[]>(
					"SELECT * FROM movies WHERE updated_at > $1 AND deleted_at IS NULL",
					[lastSyncedAt],
				)
			: await db.select<Record<string, unknown>[]>(
					"SELECT * FROM movies WHERE deleted_at IS NULL",
				);

		// Track pushed local_ids so the pull step can skip them — avoids
		// re-fetching records we just sent up.
		const pushedLocalIds = new Set<string>();

		if (localRows.length > 0) {
			const allPbRecords = await pb.collection("movies").getFullList();
			const pbIdMap = new Map(
				allPbRecords.map((r) => [r.local_id as string, r.id]),
			);

			for (const row of localRows) {
				try {
					const payload = {
						local_id: row.id,
						tmdb_id: row.tmdb_id,
						title: row.title,
						year: row.year,
						poster_url: row.poster_url,
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
					};

					const pbId = pbIdMap.get(row.id as string);
					if (pbId) {
						await pb.collection("movies").update(pbId, payload);
					} else {
						await pb.collection("movies").create(payload);
					}

					pushedLocalIds.add(row.id as string);
					pushed++;
				} catch (e) {
					errors.push(`Failed to push movie ${String(row.id)}: ${String(e)}`);
				}
			}
		}

		// --- PULL REMOTE CHANGES ---
		// Filter uses lastSyncedAt (not syncStartedAt) to catch any remote
		// changes that predate this sync. Records we just pushed are skipped
		// via pushedLocalIds to avoid redundant round-trips.
		const remoteRecords = await pb.collection("movies").getFullList({
			filter: lastSyncedAt
				? `updated >= "${toPbDate(lastSyncedAt)}"`
				: undefined,
		});

		for (const record of remoteRecords) {
			try {
				const validated = PbMovieRecordSchema.parse(record);

				if (pushedLocalIds.has(validated.local_id)) continue;

				// INSERT OR REPLACE bypasses the updated_at trigger so we
				// preserve the remote timestamp exactly as received.
				await db.execute(
					`INSERT OR REPLACE INTO movies (
						id, tmdb_id, title, year, poster_url, tmdb_rating,
						personal_rating, status, format, is_physical, is_digital,
						is_backed_up, notes, deleted_at, created_at, updated_at
					) VALUES (
						$1, $2, $3, $4, $5, $6,
						$7, $8, $9, $10, $11,
						$12, $13, $14, $15, $16
					)`,
					[
						validated.local_id,
						validated.tmdb_id,
						validated.title,
						validated.year,
						validated.poster_url,
						validated.tmdb_rating,
						validated.personal_rating,
						validated.status,
						validated.format,
						pbInt(validated.is_physical),
						pbInt(validated.is_digital),
						pbInt(validated.is_backed_up),
						validated.notes,
						validated.deleted_at,
						validated.created_at,
						validated.updated_at,
					],
				);
				pulled++;
			} catch (e) {
				errors.push(`Failed to pull record ${record.id}: ${String(e)}`);
			}
		}

		// --- UPDATE CHECKPOINT ---
		await writeLastSyncedAt(db, syncStartedAt);
		setLastSyncedAt(syncStartedAt);
		setPendingDeletes(0);

		return SyncResultSchema.parse({ pushed, pulled, errors });
	} catch (e) {
		if (e instanceof PendingDeletesError) throw e;
		const msg = e instanceof Error ? e.message : String(e);
		setError(msg);
		throw e;
	} finally {
		setSyncing(false);
	}
}
