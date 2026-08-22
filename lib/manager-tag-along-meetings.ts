import { supabase } from './supabase';
import type { ClientRow, MeetingRow, ProfileRow } from './team-remote-mappers';

/**
 * B-131 fix: a guest manager's dashboard "meetings" count and Meeting Detail
 * screen were both invisible to their own ACCEPTED meeting-context Tag-Along
 * participation whenever the meeting belonged to a completely different
 * team — `lib/manager-team-service.ts::fetchTeamOverview()` and
 * `lib/manager-dashboard-service.ts::fetchManagerDashboard()` both scope
 * their `meetings` query to `agent_id IN (own team roster)`, so a cross-team
 * tag-along meeting never appeared even though server-side quota already
 * credits it correctly (Web migration 076/077/107).
 *
 * This mirrors the same EXISTS predicate
 * `lib/manager-attendance-history-service.ts::getManagerAttendanceHistory()`
 * already uses correctly for local SQLite (scope='combined'), but as a live
 * Supabase read here since both callers are cross-team reads by design
 * (ADR-001's local-mirrors-own-data-only reasoning — see those files' own
 * doc comments). Read-only: never changes `agent_id`/`assigned_agent_id`.
 */

const MEETING_COLUMNS =
  'id, client_id, agent_id, meeting_type, location_type, location_name, gps_lat, gps_lng, end_gps_lat, end_gps_lng, photo_url, start_photo_url, end_photo_url, agenda, remarks, outcome, contact_person, contact_position, meeting_date, start_captured_at, end_captured_at, created_at, client_status_at_meeting' as const;

const CLIENT_COLUMNS =
  'id, company_name, contact_person, contact_number, office_address, customer_type, sales_channel, status, assigned_agent_id, details_deadline_at, created_at' as const;

/** Meeting IDs the manager has an accepted meeting-context Tag-Along invite for, regardless of who owns the meeting. */
export async function fetchAcceptedTagAlongMeetingIds(managerProfileId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('tag_along_requests')
    .select('related_meeting_id')
    .eq('invitee_kind', 'manager')
    .eq('invitee_id', managerProfileId)
    .eq('context', 'meeting')
    .eq('status', 'accepted');
  if (error) throw error;
  return Array.from(
    new Set((data ?? []).map((r) => r.related_meeting_id as string | null).filter((id): id is string => Boolean(id)))
  );
}

export interface TagAlongMeetingContext {
  meetings: MeetingRow[];
  agentsById: Map<string, Pick<ProfileRow, 'id' | 'full_name'>>;
  clientsById: Map<string, ClientRow>;
}

async function fetchOwningAgentsAndClients(
  meetings: MeetingRow[]
): Promise<Pick<TagAlongMeetingContext, 'agentsById' | 'clientsById'>> {
  const agentIds = Array.from(new Set(meetings.map((m) => m.agent_id)));
  const clientIds = Array.from(new Set(meetings.map((m) => m.client_id).filter((id): id is string => Boolean(id))));
  const [{ data: agentRows, error: agentError }, { data: clientRows, error: clientError }] = await Promise.all([
    agentIds.length ? supabase.from('profiles').select('id, full_name, role, team_id').in('id', agentIds) : Promise.resolve({ data: [], error: null }),
    clientIds.length ? supabase.from('clients').select(CLIENT_COLUMNS).in('id', clientIds) : Promise.resolve({ data: [], error: null }),
  ]);
  if (agentError) throw agentError;
  if (clientError) throw clientError;
  return {
    agentsById: new Map(((agentRows ?? []) as ProfileRow[]).map((p) => [p.id, p])),
    clientsById: new Map(((clientRows ?? []) as ClientRow[]).map((c) => [c.id, c])),
  };
}

/**
 * Full meeting rows (plus owning agent/client lookups so the caller can
 * resolve display names without a second round trip) for every accepted
 * tag-along meeting NOT already present in `excludeMeetingIds` (the
 * caller's own team-scoped query result — overlap should be rare but is
 * skipped to avoid duplicate rows).
 */
export async function fetchAcceptedTagAlongMeetingContext(
  managerProfileId: string,
  excludeMeetingIds: ReadonlySet<string>
): Promise<TagAlongMeetingContext> {
  const allIds = await fetchAcceptedTagAlongMeetingIds(managerProfileId);
  const meetingIds = allIds.filter((id) => !excludeMeetingIds.has(id));
  if (meetingIds.length === 0) return { meetings: [], agentsById: new Map(), clientsById: new Map() };

  const { data: meetingRows, error: meetingError } = await supabase.from('meetings').select(MEETING_COLUMNS).in('id', meetingIds);
  if (meetingError) throw meetingError;
  const meetings = (meetingRows ?? []) as MeetingRow[];
  const { agentsById, clientsById } = await fetchOwningAgentsAndClients(meetings);
  return { meetings, agentsById, clientsById };
}
