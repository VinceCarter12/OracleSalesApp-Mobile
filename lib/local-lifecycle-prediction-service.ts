import type { SQLiteDatabase } from 'expo-sqlite';
import type { ClientStatus, MeetingOutcome } from '../types';
import type { AgendaCatalogEntry } from './policies/agenda-policy';
import { predictsProspectToInProgress } from './policies/local-lifecycle-prediction';
import { getClientIdsWithPendingManagerTagAlong } from './tag-along-service';

// 2026-08-04 (Vince-approved ADR-006 exception): DB-touching caller for
// `lib/policies/local-lifecycle-prediction.ts`'s pure decision. Split out of
// lib/meeting-service.ts to keep that file under the 300-line project limit.
// Called AFTER createMeeting()'s transaction has already committed (the
// meeting is durably saved) — this write is a separate, best-effort,
// non-authoritative local mirror, never part of that transaction and never
// enqueued to the outbox.

export interface ApplyLocalLifecyclePredictionInput {
  clientId: string | null;
  requesterId: string;
  outcome: MeetingOutcome | null;
  agendaIds: readonly string[];
  agendaCatalog: readonly AgendaCatalogEntry[];
  /** This specific meeting's own validity_status — 'pending_confirmation' also blocks the prediction (this meeting itself invited an unaccepted manager companion). */
  meetingValidityStatus: 'valid' | 'pending_confirmation';
  /** ADR-061: true when this meeting carries PO evidence — see `LocalLifecyclePredictionInput.hasPoEvidence`'s doc comment. */
  hasPoEvidence: boolean;
}

/**
 * Applies the provisional prospect->in_progress local mirror, if the pure
 * policy says it applies. Deliberately narrow UPDATE: only touches
 * `status`/`in_progress_at`, guarded by `WHERE status = 'prospect'`, and
 * critically never touches `sync_status`/`local_updated_at` — this keeps the
 * row eligible for `entity-appliers.ts::upsertSyncedClient()`'s
 * `WHERE clients.sync_status = 'synced'` guard to cleanly overwrite this
 * provisional value with the server's real status on the next sync-down.
 * A no-op (never throws) when the client id is missing or the prediction
 * doesn't apply — callers should treat this as fire-and-forget-safe.
 */
export async function applyLocalLifecyclePrediction(
  db: SQLiteDatabase,
  input: ApplyLocalLifecyclePredictionInput
): Promise<void> {
  if (!input.clientId) return;
  if (input.meetingValidityStatus === 'pending_confirmation') return;

  const clientRow = await db.getFirstAsync<{ status: ClientStatus }>(
    'SELECT status FROM clients WHERE id = ?',
    [input.clientId]
  );
  if (!clientRow) return;

  const pendingManagerTagAlongClientIds = await getClientIdsWithPendingManagerTagAlong(input.requesterId);
  const hasPendingManagerTagAlong = pendingManagerTagAlongClientIds.has(input.clientId);

  const validCatalogAgendaIds = new Set(input.agendaCatalog.map((entry) => entry.agendaId));

  const shouldPromote = predictsProspectToInProgress({
    currentStatus: clientRow.status,
    outcome: input.outcome,
    agendaIds: input.agendaIds,
    validCatalogAgendaIds,
    hasPendingManagerTagAlong,
    hasPoEvidence: input.hasPoEvidence,
  });

  if (!shouldPromote) return;

  const now = new Date().toISOString();
  await db.runAsync(
    `UPDATE clients SET status = 'in_progress', in_progress_at = ? WHERE id = ? AND status = 'prospect'`,
    [now, input.clientId]
  );
}
