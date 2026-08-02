import { supabase } from './supabase';
import { isOfficePinVerified, type OfficePinSourceValue } from './policies/office-pin-policy';

// Batch 9 Step D (2026-08-02): single shared, scope-parameterized read for
// ALL THREE roles' Lost Opportunities screens — Sales/RSR's claimable list
// (Step C, `scope: 'claimable'`), the Manager team mirror
// (`scope: 'team'`, this step), and Executive's company-wide list
// (`scope: 'company'`, migrated onto this file in this step, replacing the
// now-deleted `lib/executive-lost-opportunity-service.ts`).
//
// Cooldown is 1 CALENDAR MONTH per Migration 036's `reassignable_at` trigger
// (Database.md line 406 / ADR-041 / `lib/policies/lost-opportunity-claim-policy.ts`)
// — NOT "14 days". That figure was a stale comment that had drifted into the
// old Executive-only file; fixed here during this generalization, not copied
// forward.
//
// Column names confirmed against the two files this replaces and
// `types/database.ts`'s `clients` stub — NOT guessed: `status`, `lost_at`,
// `reassignable_at`, `inactive_reason`, `assigned_agent_id`, `company_name`,
// `city`, `sales_channel`, `contact_person`, `contact_position`,
// `office_address`, `office_lat`, `office_lng`, `office_pin_source`.

const AGENT_ROLES = ['sales_specialist', 'rsr'] as const;
const MANAGER_ROLE = 'sales_manager';

export type LostOpportunityAvailability = 'available' | 'cooling';

export interface LostOpportunityRecord {
  id: string;
  companyName: string;
  city: string | null;
  channel: string | null;
  lostAt: string | null;
  reassignableAt: string | null;
  reason: string | null;
  contactPerson: string | null;
  contactPosition: string | null;
  officeAddress: string | null;
  officeLat: number | null;
  officeLng: number | null;
  officePinVerified: boolean;
  assignedAgentId: string;
  agentName: string | null;
  managerId: string | null;
  managerName: string | null;
  availability: LostOpportunityAvailability;
}

export type LostOpportunityScopeQuery =
  | { scope: 'company' }
  | { scope: 'team'; teamId: string; managerProfileId: string }
  | { scope: 'claimable'; profileId: string };

interface LostClientRow {
  id: string;
  company_name: string;
  city: string | null;
  sales_channel: string | null;
  lost_at: string | null;
  reassignable_at: string | null;
  inactive_reason: string | null;
  contact_person: string | null;
  contact_position: string | null;
  office_address: string | null;
  office_lat: number | null;
  office_lng: number | null;
  office_pin_source: OfficePinSourceValue;
  assigned_agent_id: string;
}

interface ClientCycleClientIdRow {
  client_id: string;
}

interface ProfileRow {
  id: string;
  full_name: string;
  role: string;
  team_id: string | null;
}

const LOST_CLIENT_COLUMNS =
  'id, company_name, city, sales_channel, lost_at, reassignable_at, inactive_reason, contact_person, contact_position, office_address, office_lat, office_lng, office_pin_source, assigned_agent_id';

const EMPTY_PROFILE_MAP = new Map<string, ProfileRow>();

/**
 * `reassignable_at` vs now — null-safe (treat a missing timestamp as still
 * cooling, the more conservative of the two states, matching the old
 * Executive service's same null-handling).
 */
function deriveAvailability(reassignableAt: string | null, now: Date): LostOpportunityAvailability {
  if (!reassignableAt) return 'cooling';
  return new Date(reassignableAt).getTime() <= now.getTime() ? 'available' : 'cooling';
}

async function fetchCompanyLostClientRows(): Promise<LostClientRow[]> {
  const { data, error } = await supabase.from('clients').select(LOST_CLIENT_COLUMNS).eq('status', 'lost');
  if (error) throw error;
  return (data ?? []) as LostClientRow[];
}

/** Roster-first pattern, same as `lib/manager-team-service.ts::fetchTeamProfiles` — plus the manager themselves (ADR-020: a manager can own clients directly). */
async function fetchTeamAgentIds(teamId: string, managerProfileId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name, role, team_id')
    .eq('team_id', teamId)
    .in('role', AGENT_ROLES);
  if (error) throw error;
  const agentIds = ((data ?? []) as ProfileRow[]).map((p) => p.id);
  return [...agentIds, managerProfileId];
}

async function fetchTeamLostClientRows(teamId: string, managerProfileId: string): Promise<LostClientRow[]> {
  const agentIds = await fetchTeamAgentIds(teamId, managerProfileId);
  if (agentIds.length === 0) return [];
  const { data, error } = await supabase
    .from('clients')
    .select(LOST_CLIENT_COLUMNS)
    .eq('status', 'lost')
    .in('assigned_agent_id', agentIds);
  if (error) throw error;
  return (data ?? []) as LostClientRow[];
}

/**
 * Server-side cooldown + current-owner exclusion — Step C's original
 * behavior, ported unchanged. `.lte('reassignable_at', now)` also excludes
 * `reassignable_at IS NULL` rows (a `<=` comparison against `NULL` is never
 * true in Postgres) — the conservative default. `.neq('assigned_agent_id',
 * profileId)` excludes the CURRENT-cycle former owner for free; the
 * historical-cycle exclusion (any PRIOR cycle) is a separate step below.
 */
async function fetchClaimableLostClientRows(profileId: string, nowIso: string): Promise<LostClientRow[]> {
  const { data, error } = await supabase
    .from('clients')
    .select(LOST_CLIENT_COLUMNS)
    .eq('status', 'lost')
    .lte('reassignable_at', nowIso)
    .neq('assigned_agent_id', profileId);
  if (error) throw error;
  return (data ?? []) as LostClientRow[];
}

/**
 * Migration 062: the caller's own historical `client_cycles` rows where they
 * were the owner AND lost the client — across EVERY prior cycle, not just
 * the current one.
 */
async function fetchOwnLostCycleClientIds(profileId: string): Promise<Set<string>> {
  const { data, error } = await supabase
    .from('client_cycles')
    .select('client_id')
    .eq('owner_id', profileId)
    .eq('end_reason', 'lost');
  if (error) throw error;
  return new Set(((data ?? []) as ClientCycleClientIdRow[]).map((row) => row.client_id));
}

async function fetchAgentAndManagerProfiles(): Promise<ProfileRow[]> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name, role, team_id')
    .in('role', [...AGENT_ROLES, MANAGER_ROLE]);
  if (error) throw error;
  return (data ?? []) as ProfileRow[];
}

function mapRow(
  row: LostClientRow,
  now: Date,
  agentById: Map<string, ProfileRow>,
  managerByTeamId: Map<string, ProfileRow>
): LostOpportunityRecord {
  const agent = agentById.get(row.assigned_agent_id) ?? null;
  const manager = agent?.team_id ? managerByTeamId.get(agent.team_id) ?? null : null;
  return {
    id: row.id,
    companyName: row.company_name,
    city: row.city,
    channel: row.sales_channel,
    lostAt: row.lost_at,
    reassignableAt: row.reassignable_at,
    reason: row.inactive_reason,
    contactPerson: row.contact_person,
    contactPosition: row.contact_position,
    officeAddress: row.office_address,
    officeLat: row.office_lat,
    officeLng: row.office_lng,
    officePinVerified: isOfficePinVerified(row.office_pin_source),
    assignedAgentId: row.assigned_agent_id,
    agentName: agent?.full_name ?? null,
    managerId: manager?.id ?? null,
    managerName: manager?.full_name ?? null,
    availability: deriveAvailability(row.reassignable_at, now),
  };
}

/**
 * Single scope-parameterized read for all three roles' Lost Opportunities
 * screens (Batch 9 Step D). `company` (Executive) and `team` (Manager) both
 * show BOTH available-now and still-cooling records — per
 * Wireframe-Manager-BizLink.html's `renderLostOpportunities()`
 * (`all`/`available`/`cooling` chips, defaulting to `all`) — no cooldown
 * exclusion filter applied for either. `claimable` (Sales/RSR) applies the
 * server-side cooldown/current-owner filter PLUS the historical
 * former-owner exclusion so it only ever returns rows the caller can
 * actually claim, matching Wireframe-Sales-BizLink.html's
 * `aRenderLostOpportunities()` — no chips, no cooling-down rows shown there
 * at all. Do not move the claimable scope's cooldown-exclusion filter onto
 * `team`/`company` — confirmed wireframe divergence (Manager/Executive need
 * to see cooling-down records; Sales/RSR never do).
 */
export async function fetchLostOpportunities(query: LostOpportunityScopeQuery): Promise<LostOpportunityRecord[]> {
  const now = new Date();

  if (query.scope === 'claimable') {
    const [clientRows, ownLostClientIds] = await Promise.all([
      fetchClaimableLostClientRows(query.profileId, now.toISOString()),
      fetchOwnLostCycleClientIds(query.profileId),
    ]);
    return clientRows
      .filter((row) => !ownLostClientIds.has(row.id))
      .map((row) => mapRow(row, now, EMPTY_PROFILE_MAP, EMPTY_PROFILE_MAP));
  }

  if (query.scope === 'team') {
    const clientRows = await fetchTeamLostClientRows(query.teamId, query.managerProfileId);
    return clientRows.map((row) => mapRow(row, now, EMPTY_PROFILE_MAP, EMPTY_PROFILE_MAP));
  }

  // scope === 'company'
  const [clientRows, profiles] = await Promise.all([fetchCompanyLostClientRows(), fetchAgentAndManagerProfiles()]);
  const agentById = new Map(profiles.map((p) => [p.id, p]));
  const managerByTeamId = new Map(
    profiles.filter((p) => p.role === MANAGER_ROLE && p.team_id).map((p) => [p.team_id as string, p])
  );
  return clientRows.map((row) => mapRow(row, now, agentById, managerByTeamId));
}

/**
 * Wireframe `a-lostoppdetail`'s "Last activity" section
 * (Wireframe-Sales-BizLink.html ~line 1377): the client's most recent
 * meeting, live-queried the same way the rest of this screen reads —
 * `meetings` has no local mirror for a client this agent doesn't (yet) own.
 * Reused by the Manager read-only detail screen too (same section, same
 * wireframe row anatomy, `Wireframe-Manager-BizLink.html`'s `openLostOpportunity()`
 * "Last activity" card).
 */
export interface LostOpportunityLastMeeting {
  meetingDate: string;
  summary: string;
}

interface LastMeetingRow {
  meeting_date: string;
  agenda: string[] | null;
  remarks: string | null;
  outcome: string | null;
}

export async function fetchLastMeetingSummary(clientId: string): Promise<LostOpportunityLastMeeting | null> {
  const { data, error } = await supabase
    .from('meetings')
    .select('meeting_date, agenda, remarks, outcome')
    .eq('client_id', clientId)
    .order('meeting_date', { ascending: false })
    .limit(1);
  if (error) throw error;
  const row = ((data ?? []) as LastMeetingRow[])[0];
  if (!row) return null;
  const agendaSummary = row.agenda && row.agenda.length > 0 ? row.agenda.join(', ') : null;
  const summary = row.remarks || row.outcome || agendaSummary || 'Walang detalyeng naitala.';
  return { meetingDate: row.meeting_date, summary };
}
