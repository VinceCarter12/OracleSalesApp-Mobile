// ─── Domain constants ──────────────────────────────────────────────────────────

// Sales channels per Wireframe-Agent-Executive.html a-complete (ADR-010 spec of record).
export const SALES_CHANNELS = [
  'Distributor',
  'Dealer',
  'End-User',
  'Private Label',
] as const;

// Kept for legacy DB rows; the wireframe replaced customer-type with the
// lifecycle status + sales channel. New UI never asks for this.
export const CUSTOMER_TYPES = [
  'Dealer',
  'Sub-Dealer',
  'Direct Account',
  'Government',
  'End-User',
] as const;

// Meeting agendas per Wireframe a-record. "Product / company presentation"
// is the tick that drives the presentation progress-% (B-001).
export const MEETING_AGENDAS = [
  'New business opportunity',
  'Product / company presentation',
  'Price negotiation / quotation',
  'Terms & limit negotiation',
  'Collection',
  'Technical support',
  'Complaint resolution',
  'Relationship building',
  'Closed deal',
] as const;

export const PRESENTATION_AGENDA: (typeof MEETING_AGENDAS)[number] =
  'Product / company presentation';

export const MEETING_OUTCOMES = [
  'Successful',
  'Follow-up Required',
  'No Decision',
  'Lost Opportunity',
] as const;

// Prospect lifecycle status (ADR-006). Drives the Record Meeting branch (ADR-015,
// revised 2026-07-21): new/existing → photo-only fast path (info's already
// complete, ADR-027); prospect → full form. 'inactive' is server-side
// lifecycle only (Sprint.md T-001 notes) — never chosen by an agent.
export const CLIENT_STATUSES = ['prospect', 'new', 'existing', 'inactive'] as const;

// ADR-012: online meetings bind GPS to the agent's own location, flagged so
// reporting never misreads them as client-site visits.
export const MEETING_MODES = ['in_person', 'online'] as const;

// ─── TypeScript types ──────────────────────────────────────────────────────────

export type CustomerType = typeof CUSTOMER_TYPES[number];
export type SalesChannel = typeof SALES_CHANNELS[number];
export type MeetingOutcome = typeof MEETING_OUTCOMES[number];
export type ClientStatus = typeof CLIENT_STATUSES[number];
export type MeetingMode = typeof MEETING_MODES[number];

export interface Client {
  id: string;
  company_name: string;
  contact_person: string;
  // Wireframe a-complete fields — optional until columns land in Supabase (T-001).
  position?: string | null;
  contact_number?: string | null;
  office_address?: string | null;
  customer_type: CustomerType;
  sales_channel: SalesChannel;
  // Optional until the status column lands in Supabase (T-001). Absent status
  // must resolve to 'prospect' (full form) — see getClientStatus().
  status?: ClientStatus | null;
  agent_id: string;
  created_at: string;
  updated_at: string;
  // 2026-07-21: `details_deadline_at` was already synced into local SQLite
  // (lib/sync/entity-appliers.ts) but never exposed through this type or
  // local-client-mapper.ts — needed for the My Clients list's deadline
  // countdown (Wireframe #a-clients). Null once info is completed/for
  // non-prospect clients.
  details_deadline_at?: string | null;
  sync_status?: string;
}

export interface Meeting {
  id: string;
  client_id: string | null;
  client_name?: string | null;
  agent_id: string;
  gps_lat: number;
  gps_lng: number;
  selfie_url: string | null;
  agendas: string[];
  // Null for existing-client fast-path meetings (ADR-015: photo-only, no outcome asked).
  outcome: MeetingOutcome | null;
  meeting_mode?: MeetingMode;
  // ADR-015 fast path: two photo+timestamp pairs; timestamps come from the
  // final confirmed shutter press, never a discarded retake.
  start_photo_url?: string | null;
  start_captured_at?: string | null;
  end_photo_url?: string | null;
  end_captured_at?: string | null;
  logged_at: string;
  created_at: string;
  // 2026-07-21: were write-only to Supabase until this date — local SQLite
  // never had columns for them (see lib/db.ts's v11 migration comment).
  contact_person?: string | null;
  contact_position?: string | null;
  location_type?: string | null;
  location_name?: string | null;
  remarks?: string | null;
  sync_status?: string;
}

// Mirrors the web DB role enum (Database.md) + executive (mobile-only concept,
// not in the DB). ADR-017 (2026-07-14, client decision): there is no
// `rsr_manager` — a single `sales_manager` oversees either track, and which
// track is determined by `team_id` (see RSR_TEAM_IDS below), not by role.
// RSR remains a distinct agent role (ADR-013), just not a distinct manager
// role. `superadmin`/`admin` are web-only and have no mobile screens.
export type UserRole =
  | 'sales_specialist'
  | 'rsr'
  | 'sales_manager'
  | 'executive'
  | 'admin'
  | 'superadmin'
  | 'collector';

// Fixed Supabase team IDs (mirrors web repo's lib/teams.ts) — never renumber.
// A sales_manager's `team_id` determines which track's manager UI they see.
export const RSR_TEAM_1_ID = '00000000-0000-0000-0000-000000000003';
export const RSR_TEAM_2_ID = '00000000-0000-0000-0000-000000000004';
export const RSR_TEAM_IDS: readonly string[] = [RSR_TEAM_1_ID, RSR_TEAM_2_ID];

export function isRsrTeam(teamId: string | null | undefined): boolean {
  return !!teamId && RSR_TEAM_IDS.includes(teamId);
}

// F-012: minimum daily in-person client visits — RSR role only, never Sales.
// Configurable target, not hard-coded at call sites.
export const RSR_DAILY_VISIT_QUOTA = 12;

export interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  team_id: string | null;
}

// ─── Manager dashboard (F-013) ─────────────────────────────────────────────────

export interface TeamAgent {
  id: string;
  name: string;
  initials: string;
  meetingsThisMonth: number;
  activeClients: number;
  successRate: number;
}

export interface TeamMeetingPreview {
  id: string;
  clientName: string;
  agentName: string;
  agentInitials: string;
  date: string;
  time: string;
  outcome: MeetingOutcome;
}

export interface ManagerDashboardSummary {
  managerName: string;
  teamProspects: number;
  teamClients: number;
  teamMeetings: number;
  teamMeetingsSuccessful: number;
  agentCount: number;
  pendingApprovals: number;
  pendingSyncRecords: number;
  deadlineWarningCount: number;
  pendingTagAlongRequests: number;
  agents: TeamAgent[];
  recentMeetings: TeamMeetingPreview[];
}

// ─── Manager team data (F-013) — mirrors Wireframe.html mock arrays 1:1 ───────
// No manager aggregate/team tables exist in Supabase yet (Sprint.md) — this is
// the mock data layer until that backend work is scoped.

export const MANAGER_OUTCOMES = ['success', 'follow', 'nodec', 'lost'] as const;
export type ManagerOutcome = (typeof MANAGER_OUTCOMES)[number];

export const MANAGER_OUTCOME_LABELS: Record<ManagerOutcome, MeetingOutcome> = {
  success: 'Successful',
  follow: 'Follow-up Required',
  nodec: 'No Decision',
  lost: 'Lost Opportunity',
};

export interface TeamClientChecklist {
  name: boolean;
  contact: boolean;
  number: boolean;
  address: boolean;
  channel: boolean;
}

export interface TeamClient {
  id: string;
  name: string;
  agentId: string;
  status: ClientStatus;
  channel: string;
  checklist: TeamClientChecklist;
  deadline: string;
  deadlineWarn?: boolean;
}

export interface TeamMeeting {
  id: string;
  clientId: string;
  agentId: string;
  date: string;
  time: string;
  location: string;
  contact: string;
  position: string;
  custType: string;
  agenda: string[];
  remarks: string;
  outcome: ManagerOutcome | null;
  meetingMode: MeetingMode;
  gps: string;
  tagAlong: boolean;
  tagAlongManagerName?: string;
  tagAlongStatus?: 'pending' | 'approved' | 'rejected';
  synced: boolean;
  // ADR-015 existing-client fast path — photo-only start/end, no outcome asked.
  fastPath?: boolean;
  startTime?: string;
  endTime?: string;
}

export type ApprovalType = 'edit' | 'reassign' | 'tagalong';

export interface TeamApproval {
  id: string;
  type: ApprovalType;
  clientId: string;
  agentId: string;
  field?: string;
  from?: string;
  to?: string;
  toAgentId?: string;
  meetingId?: string;
  requested: string;
}

export interface TagAlongRequest {
  id: string;
  agentId: string;
  clientId: string;
  note: string;
}

// ─── Tag-Along companion selector (ADR-030, F-015) ─────────────────────────────

/** A candidate companion (manager or teammate) for the Complete Info picker (Pass 2) — mirrors the local `team_roster_snapshot` table, itself a read-only sync-down mirror of team-scoped `profiles` rows (Migration 019). */
export interface TeamRosterEntry {
  profileId: string;
  fullName: string;
  role: Extract<UserRole, 'sales_manager' | 'sales_specialist' | 'rsr'>;
  teamId: string;
  avatarUrl: string | null;
  syncedAt: string;
}
