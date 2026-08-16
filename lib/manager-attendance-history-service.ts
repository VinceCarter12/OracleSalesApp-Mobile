import type { SQLiteDatabase } from 'expo-sqlite';
import { getDb } from './db';
import type { ManagerScope } from './manager-scope';

export interface ManagerAttendanceRecord {
  id: string;
  clientId: string | null;
  clientName: string | null;
  agentId: string;
  loggedAt: string;
  meetingMode: string | null;
  selfieUrl: string | null;
  startPhotoUrl: string | null;
  endPhotoUrl: string | null;
  syncStatus: string;
  participated: boolean;
  decisionStatus: 'mine' | 'pending' | 'accepted' | 'declined';
}
type AttendanceDb = Pick<SQLiteDatabase, 'getAllAsync'>;

interface AttendanceRow {
  id: string; client_id: string | null; client_name: string | null;
  agent_id: string; logged_at: string; meeting_mode: string | null;
  selfie_url: string | null; start_photo_url: string | null;
  end_photo_url: string | null; sync_status: string;
  request_status: 'pending' | 'accepted' | 'declined' | null;
}

/** Canonical meeting rows only. Combined adds every non-cancelled meeting-
 * context manager selection (pending/accepted/declined), then dedupes by
 * meetings.id. Client-creation requests and holder/requester paths are
 * intentionally excluded. */
export async function getManagerAttendanceHistory(
  profileId: string,
  scope: ManagerScope,
  dbOverride?: AttendanceDb,
): Promise<ManagerAttendanceRecord[]> {
  const db = dbOverride ?? await getDb();
  if (scope === 'team') return [];
  const predicate = scope === 'mine'
    ? `m.agent_id = ?`
    : `(m.agent_id = ? OR EXISTS (
         SELECT 1 FROM tag_along_requests tar
          WHERE tar.related_meeting_id = m.id
            AND tar.context = 'meeting'
            AND tar.invitee_kind = 'manager'
            AND tar.invitee_id = ?
            AND tar.status <> 'cancelled'
       ))`;
  const args = scope === 'mine' ? [profileId] : [profileId, profileId];
  const rows = await db.getAllAsync<AttendanceRow>(
    `SELECT m.id, m.client_id, COALESCE(c.company_name, m.client_name) AS client_name,
            m.agent_id, m.logged_at, m.meeting_mode, m.selfie_url,
            m.start_photo_url, m.end_photo_url, m.sync_status,
            (SELECT tar.status FROM tag_along_requests tar
               WHERE tar.related_meeting_id = m.id
                 AND tar.context = 'meeting'
                 AND tar.invitee_kind = 'manager'
                 AND tar.invitee_id = ?
                 AND tar.status <> 'cancelled'
               ORDER BY tar.updated_at DESC LIMIT 1) AS request_status
       FROM meetings m
       LEFT JOIN clients c ON c.id = m.client_id
      WHERE ${predicate}
      ORDER BY m.logged_at DESC`,
    scope === 'mine' ? [profileId, profileId] : [profileId, profileId, profileId],
  );
  return dedupeAttendanceRecords(rows.map((row) => ({
    id: row.id, clientId: row.client_id, clientName: row.client_name,
    agentId: row.agent_id, loggedAt: row.logged_at, meetingMode: row.meeting_mode,
    selfieUrl: row.selfie_url, startPhotoUrl: row.start_photo_url,
    endPhotoUrl: row.end_photo_url, syncStatus: row.sync_status,
    participated: row.agent_id !== profileId && row.request_status === 'accepted',
    decisionStatus: row.agent_id === profileId ? 'mine' : (row.request_status ?? 'pending'),
  })));
}

export function dedupeAttendanceRecords(records: readonly ManagerAttendanceRecord[]): ManagerAttendanceRecord[] {
  const seen = new Set<string>();
  return records.filter((record) => !seen.has(record.id) && (seen.add(record.id), true));
}
