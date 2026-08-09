import type { SQLiteDatabase } from 'expo-sqlite';
import { enqueueOutboxRow } from './sync/entity-registry';
import { insertMeetingCompanionRequests } from './tag-along-service';
import { insertAcceptedMeetingCompanions } from './tag-along-manager-service';
import { writeOfficePinLocal } from './office-pin-service';
import { withInsertTransactionRetry } from './sync/with-transaction-retry';
import type { ClientStatus, MeetingValidityStatus } from '../types';
import type { NewMeetingRecord } from './meeting-service';

// Split out of lib/meeting-service.ts::createMeeting() (2026-08-09) to keep
// that file under the 300-line project limit, same pattern as
// lib/meeting-po-evidence-submission.ts's earlier split. Pure extraction of
// the meeting-row INSERT transaction, now wrapped in
// `withInsertTransactionRetry` instead of a bare `db.withTransactionAsync` —
// see that helper's doc comment and Bugs.md for why (the "cannot rollback -
// no transaction is active" crash on the PO-evidence "Advance Deal" save).

export interface InsertMeetingRecordParams {
  db: SQLiteDatabase;
  id: string;
  outboxId: string;
  record: NewMeetingRecord;
  agendaIds: readonly string[];
  clientStatusAtMeeting: ClientStatus | null;
  remotePayload: Record<string, unknown>;
  createdOnline: boolean;
  validityStatus: MeetingValidityStatus;
  now: string;
}

/**
 * Inserts the `meetings` row, its `outbox` row, any companion requests, and
 * (Client Office meetings only) the office pin — all in one retried
 * transaction. See `withInsertTransactionRetry` for the retry/verify
 * contract: on the dual-connection lock-contention symptom, this checks
 * whether the meeting row already exists before deciding whether the
 * failure was spurious (row present → return normally) or real (row
 * missing → safe to retry the whole transaction, since nothing was written).
 */
export async function insertMeetingRecord(params: InsertMeetingRecordParams): Promise<void> {
  const { db, id, outboxId, record, agendaIds, clientStatusAtMeeting, remotePayload, createdOnline, validityStatus, now } = params;

  await withInsertTransactionRetry(
    db,
    async () => {
      await db.runAsync(
        `INSERT INTO meetings
          (id, client_id, agent_id, gps_lat, gps_lng, selfie_url, agendas, agenda_ids, outcome, meeting_mode,
           start_photo_url, start_captured_at, end_photo_url, end_captured_at, end_gps_lat, end_gps_lng,
           selfie_captured_at, selfie_gps_lat, selfie_gps_lng,
           logged_at, created_at, contact_person, contact_position, location_type, location_name, remarks,
           validity_status, client_status_at_meeting, sync_status, local_updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)`,
        [
          id,
          record.client_id,
          record.agent_id,
          record.gps_lat,
          record.gps_lng,
          record.selfie_url ?? null,
          JSON.stringify(record.agendas),
          JSON.stringify(agendaIds),
          record.outcome,
          record.meeting_mode,
          null,
          record.start_captured_at ?? null,
          record.end_photo_url ?? null,
          record.end_captured_at ?? null,
          record.end_gps_lat ?? null,
          record.end_gps_lng ?? null,
          record.selfie_captured_at ?? null,
          record.selfie_gps_lat ?? null,
          record.selfie_gps_lng ?? null,
          record.logged_at,
          now,
          record.contactPerson?.trim() || null,
          record.contactPosition ?? null,
          record.locationType ?? null,
          record.locationName ?? null,
          record.remarks ?? null,
          validityStatus,
          clientStatusAtMeeting,
          now,
        ]
      );
      await enqueueOutboxRow(db, {
        outboxId,
        recordId: id,
        tableName: 'meetings',
        operation: 'insert',
        payload: JSON.stringify(remotePayload),
        createdAt: now,
        createdOnline,
      });
      // ADR-030 Pass 2.5: companion requests now created at Record Meeting
      // time (moved from Complete Info) — same transaction as the meeting
      // insert + its outbox row above, so a crash between the two can never
      // strand a companion request without its outbox row, or vice versa.
      if (record.companions?.length && record.client_id) {
        const insertCompanions = record.companionsPreAccepted
          ? insertAcceptedMeetingCompanions
          : insertMeetingCompanionRequests;
        await insertCompanions(db, {
          clientId: record.client_id,
          meetingId: id,
          requesterId: record.agent_id,
          companions: record.companions,
          createdOnline,
        });
      }
      // Batch 4: Client Office meetings auto-capture the office pin from THIS
      // meeting's own start GPS ([[Office-Location-Spec-2026-07-29]]) —
      // local-only, so it stays inside this transaction (unlike the
      // network-I/O poEvidence block in meeting-service.ts). Reuses the same
      // `db` transaction handle — expo-sqlite can't nest `withTransactionAsync`.
      if (record.captureOfficePin && record.client_id) {
        await writeOfficePinLocal(db, {
          clientId: record.client_id,
          agentId: record.agent_id,
          lat: record.gps_lat,
          lng: record.gps_lng,
          source: 'client_office_meeting',
          capturedAt: record.logged_at,
        });
      }
    },
    async () => {
      const existing = await db.getFirstAsync<{ id: string }>('SELECT id FROM meetings WHERE id = ?', [id]);
      return existing !== null;
    }
  );
}
