import { getDb } from './db';
import { supabase } from './supabase';

// ADR-067 (2026-08-22, simplified same day): guest-manager record holders.
// Ownership follows the per-meeting invite, not team origin (Web migration
// 118). Holder status is derived automatically, server-side, the instant a
// manager accepts a meeting-context Tag-Along invite
// (`grant_client_holder_on_tagalong_accept()` trigger on
// `tag_along_requests`) -- there is no separate "approve/reject becoming a
// holder" decision, RPC, or column anywhere. `lib/tag-along-service.ts` /
// `lib/tag-along-invitee-service.ts` own the meeting-invite accept/decline
// flow itself; this file only reads the resulting, permanent holder set.
//
// Holder status is sticky and PERMANENT (ADR-067 decision 3) -- there is no
// revoke/removal function here, and none should ever be added without a new
// ADR.

export interface ClientRecordHolder {
  clientId: string;
  managerId: string;
  managerName: string | null;
  grantedViaRequestId: string | null;
  createdAt: string;
}

interface ClientRecordHolderRow {
  client_id: string;
  manager_id: string;
  manager_name: string | null;
  granted_via_request_id: string | null;
  created_at: string;
}

/**
 * Reads a client's current holder set from the local `client_meeting_holders`
 * mirror (synced down via `lib/sync/entity-registry.ts`'s
 * `client_meeting_holders` entity) -- most recently granted first. Joint
 * holders (ADR-067 decision 2/3: both accepted their meeting invite) both
 * appear; a single-holder client returns exactly one row. Empty means no one
 * has accepted a meeting-context invite for this client yet.
 *
 * `managerName` first tries a local join against `manager_directory_snapshot`
 * (falls back to `team_roster_snapshot` for a same-team holder) -- both are
 * SAME-TEAM roster mirrors, so a cross-team holder (the exact case Guest
 * Records exists for) is never in either one on this device. B-133
 * follow-up: any row still missing a name after the local join gets one
 * live Supabase lookup (`profiles.select('id, full_name').in('id', ...)`,
 * RLS-safe via migration 121's tag-along-participant profile read) rather
 * than falling back to a generic "Manager" label -- same reasoning as the
 * rest of B-133's fix, this data crosses team boundaries by definition and
 * a same-team-only local mirror can never be the whole answer for it.
 */
export async function getClientRecordHolders(clientId: string): Promise<ClientRecordHolder[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<ClientRecordHolderRow>(
    `SELECT cmh.client_id, cmh.manager_id,
            COALESCE(mds.full_name, trs.full_name) AS manager_name,
            cmh.granted_via_request_id, cmh.created_at
       FROM client_meeting_holders cmh
       LEFT JOIN manager_directory_snapshot mds ON mds.profile_id = cmh.manager_id
       LEFT JOIN team_roster_snapshot trs ON trs.profile_id = cmh.manager_id
      WHERE cmh.client_id = ?
      ORDER BY cmh.created_at DESC`,
    [clientId]
  );
  const unresolvedIds = Array.from(new Set(rows.filter((row) => !row.manager_name).map((row) => row.manager_id)));
  const liveNamesById = new Map<string, string>();
  if (unresolvedIds.length > 0) {
    const { data, error } = await supabase.from('profiles').select('id, full_name').in('id', unresolvedIds);
    if (!error) {
      for (const p of data ?? []) liveNamesById.set(p.id, p.full_name);
    }
  }
  return rows.map((row) => ({
    clientId: row.client_id,
    managerId: row.manager_id,
    managerName: row.manager_name ?? liveNamesById.get(row.manager_id) ?? null,
    grantedViaRequestId: row.granted_via_request_id,
    createdAt: row.created_at,
  }));
}

/**
 * Guest Records scope (2026-08-22, corrected same day per B-132 follow-up —
 * device-verified staleness bug): every client id this manager currently
 * holds, read LIVE from Supabase — NOT the local `client_meeting_holders`
 * mirror. Originally read the local mirror (cheap, no network call), but
 * that made this the ONLY piece of the Guest Records feature dependent on a
 * successful prior sync-down of `client_meeting_holders` — which throws on
 * any device that hasn't resynced since a fix like migration 120's RLS
 * recursion patch landed (sync-down's try/catch around that pull silently
 * swallows the failure, `lib/sync-down.ts` lines ~143-147), leaving the
 * local table empty while the LIVE data is already correct. Vince caught
 * this on-device: Meeting Detail (already a live query, `lib/
 * manager-tag-along-meetings.ts`) showed the held client correctly; the
 * Clients list (this function, local-only) did not, same manager, same
 * client, same moment. Matches `fetchAcceptedTagAlongMeetingIds()`'s
 * already-correct live-query pattern now — every Guest Records read is a
 * live Supabase query, no exceptions, no staleness model to reason about.
 */
export async function getHeldClientIds(managerProfileId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('client_meeting_holders')
    .select('client_id')
    .eq('manager_id', managerProfileId);
  if (error) throw error;
  return Array.from(new Set((data ?? []).map((row) => row.client_id)));
}

/** True if `profileId` currently holds `clientId` -- the local-first check a future edit-approval UI needs before letting a manager attempt `decide_client_edit_request()` (ADR-067 decision 5: any current holder may attempt it, first valid approval wins; the server RPC is still the actual authority, this is a client-side hint only). */
export async function isCurrentHolder(clientId: string, profileId: string): Promise<boolean> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ found: number }>(
    'SELECT 1 AS found FROM client_meeting_holders WHERE client_id = ? AND manager_id = ? LIMIT 1',
    [clientId, profileId]
  );
  return row !== null;
}
