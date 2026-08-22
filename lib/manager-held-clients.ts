import { supabase } from './supabase';
import { getHeldClientIds } from './client-holder-service';
import type { ClientRow, MeetingRow, ProfileRow } from './team-remote-mappers';

/**
 * Guest Records scope (2026-08-22, ADR-067 addendum "Gap found during device
 * testing"): RLS (Web migrations 118/120) already lets a holder-manager READ
 * a held client's full `clients`/`meetings` history — but no manager screen
 * ever actually queried for it, since every existing fetch
 * (`lib/manager-team-service.ts`, `lib/manager-team-map-service.ts`,
 * `lib/manager-dashboard-service.ts`) is scoped to
 * `assigned_agent_id`/`agent_id` IN (own team roster + self) only. This file
 * is the live Supabase half of the fix, structurally identical to B-131's
 * `lib/manager-tag-along-meetings.ts` (same column-limited constants
 * pattern, same batched owning-agent lookup).
 *
 * `lib/client-holder-service.ts::getHeldClientIds()` (the id lookup this
 * file starts from) is ALSO a live Supabase query, not a local read —
 * corrected same day (B-132 follow-up) after a device-verified staleness
 * bug: a local-mirror-based id lookup was the only piece of Guest Records
 * dependent on a prior sync-down of `client_meeting_holders` actually
 * succeeding, which silently fails on any device that hasn't resynced
 * since a fix like migration 120's RLS recursion patch landed. Deliberately
 * NOT read from `pullHeldClientHistory()`'s local SQLite sync-down mirror
 * (SQLite v39) anywhere in this feature — that stays a resilience/offline
 * layer only. Every field these screens show is a live Supabase read
 * (ADR-001's reasoning, see `manager-team-service.ts`'s own doc comments) —
 * no exceptions, no second staleness model to reason about.
 */

const CLIENT_COLUMNS =
  'id, company_name, contact_person, contact_number, office_address, customer_type, sales_channel, status, assigned_agent_id, details_deadline_at, created_at' as const;

const MEETING_COLUMNS =
  'id, client_id, agent_id, meeting_type, location_type, location_name, gps_lat, gps_lng, end_gps_lat, end_gps_lng, photo_url, start_photo_url, end_photo_url, agenda, remarks, outcome, contact_person, contact_position, meeting_date, start_captured_at, end_captured_at, created_at, client_status_at_meeting' as const;

export interface HeldClientContext {
  clients: ClientRow[];
  meetings: MeetingRow[];
  agentsById: Map<string, Pick<ProfileRow, 'id' | 'full_name'>>;
}

const EMPTY_HELD_CLIENT_CONTEXT: HeldClientContext = { clients: [], meetings: [], agentsById: new Map() };

async function fetchOwningAgents(clients: readonly ClientRow[]): Promise<Map<string, Pick<ProfileRow, 'id' | 'full_name'>>> {
  const agentIds = Array.from(new Set(clients.map((c) => c.assigned_agent_id)));
  if (agentIds.length === 0) return new Map();
  const { data, error } = await supabase.from('profiles').select('id, full_name, role, team_id').in('id', agentIds);
  if (error) throw error;
  return new Map(((data ?? []) as ProfileRow[]).map((p) => [p.id, p]));
}

/**
 * Every held client's full record (all fields the client/meeting cards on
 * Clients, Client Detail, Meetings list, Reports and Maps need) plus each
 * held client's ENTIRE meeting history — not just the meeting(s) that
 * originally granted holder status. This is the actual "full client history
 * visibility" ADR-067 decision 2 promised, distinct from and broader than
 * B-131's narrower "meetings I personally tagged along on" fix
 * (`lib/manager-tag-along-meetings.ts`).
 *
 * B-132 fix: a manager's own team roster and a meeting/client they hold
 * access to via ANOTHER path (own-team assignment, or B-131's tag-along
 * meeting invite) can legitimately overlap — most commonly, the specific
 * meeting that originally granted holder status also belongs to a client
 * whose full history this function separately fetches. `excludeMeetingIds`/
 * `excludeClientIds` (the caller's own team-scoped + tag-along-scoped query
 * results) are filtered out here, mirroring the existing
 * `fetchAcceptedTagAlongMeetingContext(managerProfileId, excludeMeetingIds)`
 * pattern in `lib/manager-tag-along-meetings.ts`, so the caller's combined
 * list is duplicate-free at the source rather than relying on callers to
 * dedupe.
 */
export async function fetchHeldClientContext(
  managerProfileId: string,
  excludeMeetingIds: ReadonlySet<string> = new Set(),
  excludeClientIds: ReadonlySet<string> = new Set()
): Promise<HeldClientContext> {
  const allHeldClientIds = await getHeldClientIds(managerProfileId);
  const heldClientIds = allHeldClientIds.filter((id) => !excludeClientIds.has(id));
  if (heldClientIds.length === 0) return EMPTY_HELD_CLIENT_CONTEXT;

  const [{ data: clientRows, error: clientError }, { data: meetingRows, error: meetingError }] = await Promise.all([
    supabase.from('clients').select(CLIENT_COLUMNS).in('id', heldClientIds),
    supabase.from('meetings').select(MEETING_COLUMNS).in('client_id', heldClientIds),
  ]);
  if (clientError) throw clientError;
  if (meetingError) throw meetingError;

  const clients = (clientRows ?? []) as ClientRow[];
  const meetings = ((meetingRows ?? []) as MeetingRow[]).filter((m) => !excludeMeetingIds.has(m.id));
  const agentsById = await fetchOwningAgents(clients);
  return { clients, meetings, agentsById };
}
