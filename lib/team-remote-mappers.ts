import { fromRemoteSalesChannel, fromRemoteStatus } from './remote-client-mapping';
import { fromRemoteMeetingType } from './remote-meeting-mapping';
import type {
  RemoteClientStatus,
  RemoteCustomerType,
  RemoteMeetingOutcome,
  RemoteMeetingType,
  RemoteLocationType,
  RemoteSalesChannel,
} from '../types/database';
import {
  PRESENTATION_AGENDA,
  type ClientStatus,
  type ManagerOutcome,
  type TeamAgent,
  type TeamClient,
  type TeamClientChecklist,
  type TeamMeeting,
} from '../types';

// B-054 Phase 1: pure Supabase-row-to-UI-shape mappers, shared by both the
// Manager and (future) Executive real-data read paths. No network/DB imports
// here — mirrors lib/remote-meeting-mapping.ts/lib/remote-client-mapping.ts's
// "pure translation only" split, so this file stays trivially unit-testable
// and safe to import from any layer without creating a cycle.

export interface ProfileRow {
  id: string;
  full_name: string;
  role: string;
  team_id: string | null;
}

export interface ClientRow {
  id: string;
  company_name: string;
  contact_person: string | null;
  contact_number: string | null;
  office_address: string | null;
  customer_type: RemoteCustomerType | null;
  sales_channel: RemoteSalesChannel | null;
  status: RemoteClientStatus;
  assigned_agent_id: string;
  details_deadline_at: string | null;
  created_at: string;
}

export interface MeetingRow {
  id: string;
  client_id: string | null;
  agent_id: string;
  meeting_type: RemoteMeetingType | null;
  location_type: RemoteLocationType | null;
  location_name: string | null;
  gps_lat: number;
  gps_lng: number;
  agenda: string[];
  remarks: string | null;
  outcome: RemoteMeetingOutcome | null;
  contact_person: string | null;
  contact_position: string | null;
  meeting_date: string;
  start_captured_at: string | null;
  end_captured_at: string | null;
  created_at: string;
}

export const DAY_MS = 24 * 60 * 60 * 1000;
const DEADLINE_WARN_DAYS = 7;

export function initialsOf(fullName: string): string {
  const parts = fullName.trim().split(/\s+/);
  return parts.map((p) => p[0]).join('').slice(0, 2).toUpperCase() || '—';
}

function isSameMonth(iso: string, reference: Date): boolean {
  const d = new Date(iso);
  return d.getMonth() === reference.getMonth() && d.getFullYear() === reference.getFullYear();
}

/** Days-since-epoch count of rows created on/after `since` — used for the Manager Home "this week"/"this month" trend captions (real numbers, never fabricated). */
export function countCreatedSince(rows: { created_at: string }[], since: Date): number {
  return rows.filter((r) => new Date(r.created_at).getTime() >= since.getTime()).length;
}

// ─── Agents ─────────────────────────────────────────────────────────────────

// Deliberately NOT `Pick<ClientRow/MeetingRow, ...>` — `lib/manager-dashboard-service.ts`'s
// own row shapes use plain `string | null` for `outcome` (not the narrower
// `RemoteMeetingOutcome` union this file's `MeetingRow` uses), so a
// structural `Pick` would reject its call site. These three fields are all
// this function actually touches, so a minimal standalone shape is both
// correct and the least coupled.
interface TeamAgentProfileInput {
  id: string;
  full_name: string;
}
interface TeamAgentClientInput {
  assigned_agent_id: string;
}
interface TeamAgentMeetingInput {
  agent_id: string;
  outcome: string | null;
  meeting_date: string;
}

/**
 * Extracted from `lib/manager-dashboard-service.ts`'s previously-inline
 * builder (2026-07-16) — same logic, now shared with `lib/manager-team-service.ts`.
 * Keyed strictly by whatever `id` the caller supplies per profile row — the
 * dashboard service intentionally still passes its own `user_id` value here
 * (a known separate issue, B-055, not silently fixed by this dedup pass).
 */
export function buildTeamAgents(
  profiles: TeamAgentProfileInput[],
  clients: TeamAgentClientInput[],
  meetings: TeamAgentMeetingInput[],
  now: Date
): TeamAgent[] {
  const thisMonthMeetings = meetings.filter((m) => isSameMonth(m.meeting_date, now));
  return profiles.map((p) => {
    const agentAllMeetings = meetings.filter((m) => m.agent_id === p.id);
    const successCount = agentAllMeetings.filter((m) => m.outcome === 'successful').length;
    return {
      id: p.id,
      name: p.full_name,
      initials: initialsOf(p.full_name),
      meetingsThisMonth: thisMonthMeetings.filter((m) => m.agent_id === p.id).length,
      activeClients: clients.filter((c) => c.assigned_agent_id === p.id).length,
      successRate: agentAllMeetings.length ? Math.round((successCount / agentAllMeetings.length) * 100) : 0,
    };
  });
}

// ─── Clients ────────────────────────────────────────────────────────────────

function formatShortDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

/**
 * Wireframe #a-clients deadline countdown — no formula in the wireframe
 * itself (implementer judgment call, matches the agent-side equivalent in
 * `lib/client-deadline.ts`): non-prospect or missing deadline → em-dash,
 * <= 7 days → short red warning, further out → "Mon D (N days)".
 */
function computeDeadline(
  status: ClientStatus,
  detailsDeadlineAt: string | null,
  now: Date
): { deadline: string; deadlineWarn?: boolean } {
  if (status !== 'prospect' || !detailsDeadlineAt) return { deadline: '—' };
  const deadline = new Date(detailsDeadlineAt);
  const daysLeft = Math.ceil((deadline.getTime() - now.getTime()) / DAY_MS);
  if (daysLeft <= DEADLINE_WARN_DAYS) {
    return { deadline: `${daysLeft} day${daysLeft === 1 ? '' : 's'} left`, deadlineWarn: true };
  }
  return { deadline: `${formatShortDate(detailsDeadlineAt)} (${daysLeft} days)` };
}

function buildChecklist(row: ClientRow): TeamClientChecklist {
  return {
    name: Boolean(row.company_name),
    contact: Boolean(row.contact_person),
    number: Boolean(row.contact_number),
    address: Boolean(row.office_address),
    channel: Boolean(row.sales_channel),
  };
}

/** "Prospect"/"New"/"Existing"/"Inactive" — display label for a client's lifecycle status, used as `TeamMeeting.custType`. */
export function clientStatusLabel(status: ClientStatus): string {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

export function mapClientRowToTeamClient(row: ClientRow, now: Date): TeamClient {
  const status = fromRemoteStatus(row.status, row.customer_type);
  const { deadline, deadlineWarn } = computeDeadline(status, row.details_deadline_at, now);
  return {
    id: row.id,
    name: row.company_name,
    agentId: row.assigned_agent_id,
    status,
    channel: fromRemoteSalesChannel(row.sales_channel),
    checklist: buildChecklist(row),
    deadline,
    ...(deadlineWarn ? { deadlineWarn } : {}),
    createdAt: row.created_at,
  };
}

// ─── Meetings ───────────────────────────────────────────────────────────────

const REMOTE_TO_MANAGER_OUTCOME: Record<RemoteMeetingOutcome, ManagerOutcome> = {
  successful: 'success',
  follow_up: 'follow',
  no_decision: 'nodec',
  lost_opportunity: 'lost',
};

/**
 * Written fresh rather than reusing `fromRemoteOutcome` (lib/remote-meeting-mapping.ts)
 * — that function returns full display-label strings (`'Successful'`, etc.)
 * for a different consumer; `TeamMeeting.outcome` needs the mock's short
 * codes (`'success'`/`'follow'`/...) that `MANAGER_OUTCOME_LABELS` expects.
 */
function toManagerOutcome(outcome: RemoteMeetingOutcome | null): ManagerOutcome | null {
  return outcome ? REMOTE_TO_MANAGER_OUTCOME[outcome] : null;
}

function resolveLocation(row: Pick<MeetingRow, 'meeting_type' | 'location_type' | 'location_name'>): string {
  if (row.meeting_type === 'online') return 'Online (video call)';
  if (row.location_type === 'other') return row.location_name || 'Others';
  return 'Client Office';
}

function formatGps(lat: number, lng: number): string {
  return `${lat.toFixed(4)}° N, ${lng.toFixed(4)}° E`;
}

export function mapMeetingRowToTeamMeeting(row: MeetingRow, clientCustomerType: string): TeamMeeting {
  return {
    id: row.id,
    clientId: row.client_id ?? '',
    agentId: row.agent_id,
    date: formatShortDate(row.meeting_date),
    time: formatTime(row.meeting_date),
    location: resolveLocation(row),
    contact: row.contact_person || '—',
    position: row.contact_position || '—',
    custType: clientCustomerType,
    agenda: row.agenda ?? [],
    remarks: row.remarks ?? '',
    outcome: toManagerOutcome(row.outcome),
    meetingMode: fromRemoteMeetingType(row.meeting_type),
    gps: formatGps(row.gps_lat, row.gps_lng),
    // B-053 owns real tag-along data separately — out of scope this pass.
    tagAlong: false,
    // A row read live from Supabase is synced by definition.
    synced: true,
    fastPath: row.outcome === null,
    startTime: row.start_captured_at ? formatTime(row.start_captured_at) : undefined,
    endTime: row.end_captured_at ? formatTime(row.end_captured_at) : undefined,
    meetingDateIso: row.meeting_date,
  };
}

// ─── Progress % ─────────────────────────────────────────────────────────────

/**
 * Mirrors `lib/client-progress.ts::getClientProgressBreakdown()` /
 * `lib/manager-data.ts::computeTeamClientProgress()` exactly (B-001/ADR):
 * 100% once a meeting's agenda included "Product / company presentation",
 * 0% otherwise. Info completion has zero weight — do not reintroduce the
 * rejected blended formula.
 */
export function computeTeamClientProgress(client: TeamClient, meetings: TeamMeeting[]): number {
  const presented = meetings.some((m) => m.clientId === client.id && m.agenda.includes(PRESENTATION_AGENDA));
  return presented ? 100 : 0;
}

// Reports timeframe helpers (`ReportTimeframe`, `timeframeStart()`,
// `countNewClientsAcquired()`, `filterMeetingsByTimeframe()`) live in
// `lib/report-timeframe.ts` — split out 2026-07-22 (quality-gate fix) to keep
// this file under the 300-line cap.
