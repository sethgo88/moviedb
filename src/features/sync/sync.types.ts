import type { z } from "zod";
import type { PbMovieRecordSchema, SyncResultSchema } from "./sync.schema";

export type PbMovieRecord = z.infer<typeof PbMovieRecordSchema>;
export type SyncResult = z.infer<typeof SyncResultSchema>;
