import type { SQLiteDatabase } from 'expo-sqlite';

// lib/sync/sync-progress.ts's `beginSyncProgress(total)` needs to know how
// many outbox + pending_uploads rows are due for THIS pass BEFORE
// pushDueOutboxRows()/processPendingUploads() start consuming them. These two
// counters deliberately mirror sync-engine.ts's processOutbox() row query and
// photo-uploads.ts's processPendingUploads() row query exactly, so the
// progress total and the actual push queries never drift apart. Kept in
// their own small file rather than added to sync-engine.ts/photo-uploads.ts
// — both are already near/over this repo's 300-line file limit.

export async function countDueOutboxRows(db: SQLiteDatabase, now: string): Promise<number> {
  const row = await db.getFirstAsync<{ count: number }>(
    `SELECT COUNT(*) as count FROM outbox WHERE status = 'pending' AND (next_attempt_at IS NULL OR next_attempt_at <= ?)`,
    [now]
  );
  return row?.count ?? 0;
}

export async function countDuePendingUploads(db: SQLiteDatabase, agentId: string, now: string): Promise<number> {
  const row = await db.getFirstAsync<{ count: number }>(
    `SELECT COUNT(*) as count FROM pending_uploads WHERE agent_id = ? AND status = 'pending' AND (next_attempt_at IS NULL OR next_attempt_at <= ?)`,
    [agentId, now]
  );
  return row?.count ?? 0;
}
