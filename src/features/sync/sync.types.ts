import type { z } from "zod";
import type {
	SupabaseMovieRecordSchema,
	SyncConflictSchema,
	SyncResultSchema,
} from "./sync.schema";

export type SupabaseMovieRecord = z.infer<typeof SupabaseMovieRecordSchema>;
export type SyncConflict = z.infer<typeof SyncConflictSchema>;
export type SyncResult = z.infer<typeof SyncResultSchema>;
