// Batch 1 (ADR-036/ADR-037) scaffolding — types only, no live consumer yet.

export interface SyncCursor {
  tableName: string;
  lastPulledAt: string;
}

export interface TombstoneRecord {
  id: string;
  tableName: string;
  deletedAt: string;
  deletedBy: string | null;
}
