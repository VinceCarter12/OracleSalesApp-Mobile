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
//
// The legacy literal was 'Closed deal'; changed 2026-07-26 to 'Close deal'
// to match the wireframe's canonical string (Batch 0 decision item 4).
// `lib/policies/agenda.ts::getCanonicalAgenda()` normalizes any legacy
// 'Closed deal' value found in old stored/queued data at read time — it is
// never rewritten in place.
//
// B-083 fix (2026-07-29): 'Collection' and 'Complaint resolution' removed —
// ADR-045 retired them from the live 7-item v1 agenda_catalog seed
// (Migration-038-Report.md lines 223-230) and Vince approved the actual
// picker removal on 2026-07-29 (previously the label list still had 9 items
// despite the ADR decision). The remaining 7 match `agenda_catalog.display_label`
// verbatim.
export const MEETING_AGENDAS = [
  'New business opportunity',
  'Product / company presentation',
  'Price negotiation / quotation',
  'Terms & limit negotiation',
  'Relationship building',
  'Technical support',
  'Close deal',
] as const;

export const PRESENTATION_AGENDA: (typeof MEETING_AGENDAS)[number] =
  'Product / company presentation';

// ADR-044/046: the display-label the PO-evidence card gates on (matches the
// wireframe's own string checks, e.g. `aRecordAgendas.indexOf('Close deal')`
// in Wireframe-Sales-BizLink.html) — not the stable `close_deal` agenda id
// from `lib/policies/agenda-policy.ts`, since `record.tsx` still selects
// agendas by label (`lib/meeting-agenda-stage-source.ts` now wires that
// module's stage-aware filtering in to narrow which labels are OFFERED per
// stage, but selection itself remains label-based). B-083 fix:
// `lib/meeting-service.ts::createMeeting()` maps these labels to their
// canonical `agenda_id`s before save, but the picker itself is unchanged.
export const CLOSE_DEAL_AGENDA: (typeof MEETING_AGENDAS)[number] = 'Close deal';

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
// ADR-042 (2026-07-27): 'in_progress' is a real, server-reachable stage as of
// Migrations 038/040/043 (applied live) — the prospect->in_progress->new
// transitions are 100% server-authoritative (mobile never writes this value,
// see lib/remote-client-mapping.ts::toRemoteCustomerType()); it only needs to
// be representable here so the app can display it correctly.
export const CLIENT_STATUSES = ['prospect', 'in_progress', 'new', 'existing', 'inactive'] as const;

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
  // Batch 6 PR D: exposed for the Complete/Edit Info form's company_name
  // duplicate check (lib/client-duplicate-check.ts), which is (name, city)-
  // scoped — was already stored in SQLite (lib/db.ts) but never surfaced
  // through this type/local-client-mapper.ts before now.
  city?: string | null;
  contact_person: string;
  // Wireframe a-complete fields — optional until columns land in Supabase (T-001).
  position?: string | null;
  contact_number?: string | null;
  office_address?: string | null;
  customer_type: CustomerType;
  // B-0xx fix (2026-08-09): no longer defaulted at creation time — null until
  // the agent actually picks a channel in Complete Info (see
  // lib/client-service.ts::createClient() and Bugs.md). The info-completion
  // checklist (lib/client-progress.ts) relies on this being genuinely unset.
  sales_channel: SalesChannel | null;
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
  // ADR-041/044 (Batch 3, SQLite v14): mirrors remote `clients.current_cycle_id`
  // — the client's currently open ownership cycle, needed by PO confirmation
  // (`po_confirmation_requests.cycle_id` is NOT NULL). Null for a client with
  // no open cycle (e.g. never synced down since entering a cycle, or a
  // pre-Batch-3 local row).
  cycle_id?: string | null;
  // Batch 4 (2026-07-29, SQLite v20): permanent client office pin — distinct
  // from meeting GPS evidence, see [[Office-Location-Spec-2026-07-29]]. Set
  // via lib/office-pin-service.ts either explicitly (Client Detail's
  // Set/Update Office Location, `'manual'`) or automatically when a Client
  // Office meeting is recorded (`'client_office_meeting'`). Null until the
  // first pin is captured.
  office_lat?: number | null;
  office_lng?: number | null;
  office_pin_updated_at?: string | null;
  office_pin_source?: 'manual' | 'client_office_meeting' | null;
  // ADR-052 (Batch 6 Phase 5, SQLite v21): approval-EXEMPT field (Manager
  // approval NOT required for edits) — set directly via
  // `lib/client-service.ts::updateClientInfo()`, never through a
  // `client_edit_requests` row. No UI reads/writes this yet (Phase 8's job).
  minor_notes?: string | null;
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
  end_gps_lat?: number | null;
  end_gps_lng?: number | null;
  selfie_captured_at?: string | null;
  selfie_gps_lat?: number | null;
  selfie_gps_lng?: number | null;
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
  // ADR-046 (correction addendum, 2026-07-28): set once at creation
  // (lib/meeting-service.ts::createMeeting) — 'pending_confirmation' only
  // when a selected companion is a MANAGER-kind tag-along that isn't
  // pre-accepted (i.e. NOT a manager recording their own meeting); a
  // teammate-only (or no) companion is 'valid' immediately. Re-evaluated by
  // lib/tag-along-validity-service.ts on sync-down once the manager
  // responds — accepted clears it to 'valid', declined leaves it
  // 'pending_confirmation' permanently (the record itself is never
  // discarded). Optional because pre-migration-15 local rows read through
  // `SELECT m.*` before this column existed would omit it — treat missing
  // as 'valid' (SQLite's own column default), never as pending.
  validity_status?: MeetingValidityStatus;
  /**
   * B-095 fix (2026-08-08, Migration v26): the client's `status` at the
   * moment THIS meeting was recorded — frozen forever, set once by
   * `lib/meeting-service.ts::createMeeting()`, never recomputed from the
   * client's current row. Null for meetings recorded before this column
   * existed (legacy rows) or with no `client_id` — callers must omit the
   * lifecycle badge rather than fall back to the live client status. Use
   * `lib/client-status.ts::getMeetingLifecycleStatus()`, never read this
   * field directly.
   */
  client_status_at_meeting?: ClientStatus | null;
}

/** ADR-046 correction addendum: mirrors the wireframe's `meeting.validityStatus` field name/values exactly (Wireframe-Sales-BizLink.html). */
export type MeetingValidityStatus = 'valid' | 'pending_confirmation';

// Mirrors the web DB role enum (Database.md) + executive (mobile-only concept,
// not in the DB). ADR-017 (2026-07-14, client decision): there is no
// `rsr_manager` — a single `sales_manager` role covers every team. Teams are
// no longer segregated by a Sales-vs-RSR "track" (retired 2026-07-23): every
// team mixes a manager + sales_specialist + rsr agent together. RSR remains a
// distinct agent role (ADR-013), just not a distinct manager role.
// `superadmin`/`admin` are web-only and have no mobile screens.
export type UserRole =
  | 'sales_specialist'
  | 'rsr'
  | 'sales_manager'
  | 'executive'
  | 'admin'
  | 'superadmin'
  | 'collector'
  // F-007 first draft (2026-07-25): driver role for the Delivery module.
  // NOT in the web DB role enum yet (Database.md lists only `collector`) —
  // mobile-side placeholder like `executive` until the web enum adds it.
  | 'delivery';

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
  /** B-060 addendum: `clients.created_at`, real-data-only (real read path via `lib/manager-team-service.ts` always sets it; mock fixtures in `lib/manager-data.ts` don't carry a real timestamp so leave it unset there). Used for Reports' timeframe-scoped "new clients acquired" stat. */
  createdAt?: string;
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
  // Quality-gate fix (2026-07-22): raw `meetings.meeting_date` ISO string,
  // real-data-only (real read path via `lib/team-remote-mappers.ts` always
  // sets it; mock fixtures in `lib/manager-data.ts` don't carry one, same
  // optional-field tradeoff as `TeamClient.createdAt`). Lets Reports screens
  // scope "Total meetings"/"Successful"/"Lost opportunities" to the selected
  // Timeframe chip via `lib/report-timeframe.ts::filterMeetingsByTimeframe()`
  // — the pre-formatted `date` string above can't be parsed back reliably.
  meetingDateIso?: string;
  /**
   * B-095 fix (2026-08-08): mirrors `Meeting.client_status_at_meeting` — the
   * client's status frozen at the moment this meeting was recorded, never
   * the client's live status. Null for legacy meetings (pre-Migration v26)
   * or rows read via a path that doesn't select the column yet (Executive,
   * out of scope this batch). Use `getMeetingLifecycleStatus()`.
   */
  clientStatusAtMeeting?: ClientStatus | null;
}

// ─── Tag-Along companion selector (ADR-030, F-015) ─────────────────────────────

/** A candidate companion (manager or teammate) for the Complete Info picker (Pass 2) — mirrors the local `team_roster_snapshot` table, itself a read-only sync-down mirror of team-scoped `profiles` rows (Migration 019). */
export interface TeamRosterEntry {
  profileId: string;
  fullName: string;
  role: Extract<UserRole, 'sales_manager' | 'sales_specialist' | 'rsr'>;
  teamId: string;
  isActive: boolean;
  avatarUrl: string | null;
  syncedAt: string;
}

// ─── Executive company-wide data (B-054 Phase 2) ───────────────────────────────
// Originally moved here from `lib/executive-data.ts` (2026-07-21) — these
// were mock-only shapes; `lib/executive-overview-service.ts` now assembles
// real instances of them from Supabase. `lib/executive-data.ts` itself was
// deleted 2026-07-23 (B-060 addendum) once its last three mock consumers
// (Lost Opportunity, Approvals Log → Tag-Along Log, Maps) were wired to real
// data — see lib/lost-opportunity-read-service.ts (Lost Opportunity, scope
// 'company' as of Batch 9 Step D 2026-08-02) and
// lib/executive-tagalong-log-service.ts for the two new read paths.

export interface ExecAvatarStyle {
  background: string;
  color: string;
}

export interface ExecManager {
  id: string;
  name: string;
  initials: string;
  avatar: ExecAvatarStyle;
  meetings: number;
  clients: number;
  agentCount: number;
}

export interface ExecAgent {
  id: string;
  // Null-safe (B-054 Phase 2): a real agent profile's team_id may not match
  // any manager profile's team_id (e.g. an orphaned/unassigned team) — never
  // guessed at, unlike the mock data where every agent had a manager.
  managerId: string | null;
  name: string;
  initials: string;
  // Agent's own `profiles.role` (2026-07-23: team-level "track" retired —
  // an agent's role label must come from its own role, never a manager's).
  role: Extract<UserRole, 'sales_specialist' | 'rsr'>;
  avatar: ExecAvatarStyle;
  meetings: number;
  clients: number;
  rate: number;
}

export interface ExecClientChecklist {
  name: boolean;
  contact: boolean;
  number: boolean;
  address: boolean;
  channel: boolean;
}

export interface ExecClient {
  id: string;
  name: string;
  agentId: string;
  managerId: string | null;
  status: ClientStatus;
  channel: string;
  checklist: ExecClientChecklist;
  /** B-060 addendum: `clients.created_at`, real-data-only — see `TeamClient.createdAt` for the same tradeoff note. Used for Executive Reports' timeframe-scoped "new clients acquired" stat. */
  createdAt?: string;
}

export interface ExecMeeting {
  id: string;
  clientId: string;
  /** B-060 addendum: company name, looked up against ALL clients (not just active ones — a meeting can belong to a since-lost/deleted client) for the Executive Maps list. */
  companyName: string;
  agentId: string;
  date: string;
  time: string;
  location: string;
  contact: string;
  position: string;
  agenda: string[];
  remarks: string;
  // ADR-015 existing-client fast-path meetings have no outcome — nullable
  // since real live-read rows include those, unlike the old mock data.
  outcome: ManagerOutcome | null;
  gps: string;
  synced: boolean;
  // Quality-gate fix (2026-07-22): see `TeamMeeting.meetingDateIso` for the
  // same rationale — used by the Executive Reports Timeframe filter.
  meetingDateIso?: string;
}
