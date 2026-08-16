// lib/sync/sync-progress.ts
//
// Lightweight in-memory pub/sub (same deliberately-no-new-dependency style as
// ./sync-events.ts) reporting incremental push progress for the floating
// "Uploading..." card (components/sync/SyncUploadProgressCard.tsx).
// Count-based, not byte-level (Vince's explicit choice, 2026-08-16) — real
// per-file upload-progress events would require replacing the Supabase
// Storage upload transport in photo-upload-registry.ts, which is out of
// scope.
//
// lib/sync-engine.ts's runSyncOnce() calls beginSyncProgress(total) once,
// seeding `total` from lib/sync/due-counts.ts's snapshot of due outbox rows +
// due pending_uploads rows BEFORE either lane starts pushing. Each row/upload
// then calls reportSyncProgressStep() exactly once, at its TERMINAL outcome
// (synced, failed, or conflicted) — see push-batch.ts's pushDueOutboxRows()
// and photo-uploads.ts's processPendingUploads(). runSyncOnce() calls
// endSyncProgress() once both lanes finish pushing (before the slower
// syncDown() pull), which is also what tells the card to auto-dismiss.
//
// Known, documented simplifications (not bugs):
// - The total excludes the smaller collection-payment/COD-payment lanes
//   (processCollectionPayments/processCodPayments in sync-engine.ts).
// - A pending_uploads row that gets SKIPPED this pass (its parent hasn't
//   synced yet) counts toward `total` but never calls
//   reportSyncProgressStep() this pass — it resolves on a later pass instead.
// - A row blocked by isBlockedByDependency() in pushDueOutboxRows() behaves
//   the same way.
// Both mean the percentage can plateau below 100% within a single pass; it
// still always ends (endSyncProgress() is unconditional), so the card never
// gets stuck open.

export interface SyncProgressState {
  total: number;
  completed: number;
}

type Listener = (state: SyncProgressState | null) => void;

let currentState: SyncProgressState | null = null;
const listeners = new Set<Listener>();

function notify(): void {
  for (const listener of listeners) listener(currentState);
}

/** Starts a new progress pass. `total` of 0 is valid (nothing due) — callers should generally skip calling this at all when total is 0 so the card never flashes open for an empty pass (see sync-engine.ts). */
export function beginSyncProgress(total: number): void {
  currentState = { total, completed: 0 };
  notify();
}

/** Called once per row/upload's terminal outcome. No-op if no pass is active (e.g. the pre-pass recovery/heal calls in runSyncOnce() that run before beginSyncProgress()). */
export function reportSyncProgressStep(): void {
  if (!currentState) return;
  currentState = { total: currentState.total, completed: currentState.completed + 1 };
  notify();
}

/** Ends the current pass — clears state so subscribers hide/dismiss the card. Safe to call even if no pass was ever begun. */
export function endSyncProgress(): void {
  currentState = null;
  notify();
}

export function subscribeSyncProgress(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/**
 * Derives a display percentage. Capped at 100 — a pass can process MORE rows
 * than its start-of-pass total (e.g. a fresh photo-URL-patch outbox row
 * enqueued mid-pass, see sync-engine.ts's `photoPatchResult`). Returns 0 for
 * the total<=0 edge case instead of NaN/Infinity from a divide-by-zero.
 */
export function getSyncProgressPercent(state: SyncProgressState | null): number {
  if (!state || state.total <= 0) return 0;
  return Math.min(100, Math.round((state.completed / state.total) * 100));
}

/** Test-only reset — module state otherwise persists across the whole process/test file. */
export function __resetSyncProgressForTests(): void {
  currentState = null;
  listeners.clear();
}
