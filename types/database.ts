// Real remote value sets, sourced directly from
// supabase/migrations/001_initial.sql + 013_mobile_two_phase_lifecycle_and_address.sql
// (fetched from Cedie99/OracleSalesApp-Web 2026-07-15) — NOT mobile's own
// domain types (`CustomerType`/`SalesChannel`/`ClientStatus` in `./index`),
// which use different names/casing for different concepts. See ADR-018's
// 2026-07-15 revision and lib/remote-client-mapping.ts for the translation.
// ADR-042 (Migration 038, applied live 2026-07-27): four-stage lifecycle
// widens the `clients_customer_type_check` CHECK constraint to
// `('prospect','in_progress','new','existing')`. Mobile never WRITES
// 'in_progress' itself (server-authoritative transitions only, see
// `lib/remote-client-mapping.ts::toRemoteCustomerType()`) — this widening is
// so the app can correctly READ/display a client the server has already
// advanced into that stage.
export type RemoteCustomerType = 'existing' | 'new' | 'in_progress' | 'prospect';
export type RemoteSalesChannel = 'distributor' | 'dealer' | 'end_user' | 'private_label';
export type RemoteClientStatus = 'active' | 'inactive' | 'lost' | 'deleted';

// Confirmed 2026-07-16 via `pg_constraint` CHECK constraints on `meetings`
// (see Bugs.md B-012) — mobile's own `MeetingMode`/`MeetingOutcome` domain
// types (./index) use entirely different casing/wording; translation lives
// in lib/meeting-service.ts::createMeeting().
export type RemoteMeetingType = 'f2f' | 'online';
export type RemoteLocationType = 'client_office' | 'other';
export type RemoteOnlinePlatform = 'zoom' | 'googlemeet';
export type RemoteMeetingOutcome = 'successful' | 'follow_up' | 'no_decision' | 'lost_opportunity';

// ADR-030 / Migration 019 (drafted — see Migration-019-Report.md, not yet
// applied to Supabase): shared table serving both client-creation companions
// (`context='client_creation'`) and F-004's future meeting tag-alongs
// (`context='meeting'`).
export type RemoteTagAlongContext = 'client_creation' | 'meeting';
export type RemoteTagAlongInviteeKind = 'manager' | 'teammate';
export type RemoteTagAlongStatus = 'pending' | 'accepted' | 'declined' | 'cancelled';

// ADR-045 / Migration 035 + 038 Part D (Migration-035-Report.md,
// Migration-038-Report.md): versioned agenda-policy system + per-cycle
// pinning. `RemoteAgendaStage` is deliberately narrower than mobile's own
// four-stage `StageId` (lib/policies/identifiers.ts) — the live
// `agenda_stage_rules_stage_check` CHECK constraint only allows
// 'prospect'/'in_progress' (Migration-038-Report.md line 203); 'new'/
// 'existing' never get stage-rule rows (ADR-046 #5: those stages show a
// fixed hardcoded agenda list, not a stage-rule lookup).
export type RemoteAgendaStage = 'prospect' | 'in_progress';
export type RemoteClientCycleEndReason = 'lost' | 'superseded' | 'deleted';

// ADR-044 / Migration 039 (Migration-039-Report.md): domain-specific PO
// confirmation approval table — NOT merged with `tag_along_requests`. Only
// 'pending'/'approved'/'rejected'/'cancelled' are valid remotely (line 40);
// mobile's own local-only 'draft' status (captured offline, not yet
// submitted — see lib/db.ts's po_confirmation_requests table) never leaves
// the device, so it is NOT part of this remote-shape union.
export type RemotePoConfirmationStatus = 'pending' | 'approved' | 'rejected' | 'cancelled';

// Migration 042 (Migration-042-Report.md): the literal UNIONed by both
// `get_manager_approval_feed()` and `get_my_request_statuses()` —
// ADR-046 correction addendum point 3 is explicit that this is
// 'po_confirmation', never the shorthand 'po'.
export type RemoteApprovalRequestKind = 'po_confirmation' | 'tag_along';

/**
 * Supabase database type stubs.
 * Replace with the generated types from: npx supabase gen types typescript --project-id <your-id>
 */
export type Database = {
  public: {
    Tables: {
      clients: {
        Row: {
          id: string;
          company_name: string;
          contact_person: string;
          // Real column name is `contact_position`, NOT `position`.
          contact_position: string | null;
          contact_number: string | null;
          office_address: string | null;
          // Migration 013 (applied 2026-07-14) — structured address; city is
          // the scoping column for T-005's duplicate-detection uniqueness.
          city: string | null;
          customer_type: RemoteCustomerType | null;
          sales_channel: RemoteSalesChannel | null;
          status: RemoteClientStatus;
          lost_at: string | null;
          reassignable_at: string | null;
          // Confirmed present on the live schema (Database.md's 2026-07-14
          // `information_schema.columns` verification) — populated by the
          // manual Inactive→Lost-Opportunity flow (web-side today; no
          // mobile write path sets this yet, mirrors local schema's
          // `clients.inactive_reason TEXT`, lib/db.ts). Previously missing
          // from this stub even though `lib/sync/entity-appliers.ts` already
          // reads it off a loosely-typed remote row during sync-down.
          inactive_reason: string | null;
          // Real column name, confirmed via PostgREST introspection
          // (2026-07-15) — NOT `agent_id`, unlike `meetings`.
          assigned_agent_id: string;
          // Generated column from Migration 014 (drafted, not yet applied —
          // see Migration-014-Report.md). Queries against it will error
          // (column doesn't exist) until Vince applies the migration; T-005's
          // duplicate check catches that and falls back to local-only checks.
          normalized_company_name: string | null;
          // Live since Migration 013 (2026-07-14)/021 (2026-07-21, B-052) —
          // confirmed present via `information_schema.columns`
          // (Database.md's migration table). Previously missing from this
          // stub even though `lib/client-service.ts::createClient()` already
          // writes it (that path goes through JSON.stringify + a same-`any`
          // cast at push time, so the gap never surfaced there); a direct
          // typed `.select()`/`.update()` call needs it declared here.
          details_deadline_at: string | null;
          // Migration 035 (Migration-035-Report.md lines 62-64):
          // server-maintained-only pointer to the client's open
          // `client_cycles` row; never written by mobile.
          current_cycle_id: string | null;
          cycle_started_at: string | null;
          // Migration 038 Part A (Migration-038-Report.md line 78):
          // stamped once when the client enters 'in_progress', so a single
          // meeting can't chain both stage transitions in one firing.
          // Mobile never writes this (server-authoritative), same rule as
          // `customer_type` itself — see `RemoteCustomerType`'s doc comment.
          in_progress_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<
          Database['public']['Tables']['clients']['Row'],
          | 'id'
          | 'created_at'
          | 'updated_at'
          | 'normalized_company_name'
          | 'lost_at'
          | 'reassignable_at'
          | 'inactive_reason'
          | 'current_cycle_id'
          | 'cycle_started_at'
          | 'in_progress_at'
        >;
        Update: Partial<Database['public']['Tables']['clients']['Insert']>;
        Relationships: [];
      };
      meetings: {
        // Confirmed 2026-07-16 via `information_schema.columns` (see
        // Bugs.md B-011) — this stub previously used mobile's own local field
        // names (`agendas`, `meeting_mode`, `selfie_url`, `logged_at`) as if
        // they were the real remote column names; they aren't. Real columns:
        // `agenda`, `meeting_type`, `photo_url`, `meeting_date`. The
        // translation lives in `lib/meeting-service.ts::createMeeting()`
        // (same pattern as `lib/remote-client-mapping.ts` for clients).
        Row: {
          id: string;
          client_id: string | null;
          agent_id: string;
          recorded_by: string | null;
          meeting_type: RemoteMeetingType | null;
          online_platform: RemoteOnlinePlatform | null;
          location_type: RemoteLocationType | null;
          location_name: string | null;
          gps_lat: number;
          gps_lng: number;
          photo_url: string | null;
          agenda: string[];
          remarks: string | null;
          outcome: RemoteMeetingOutcome | null;
          contact_person: string | null;
          contact_position: string | null;
          meeting_date: string;
          start_photo_url: string | null;
          start_captured_at: string | null;
          end_photo_url: string | null;
          end_captured_at: string | null;
          // 2026-07-16 revision (revises ADR-015): start step drops its photo
          // requirement, keeping only gps_lat/gps_lng + start_captured_at
          // above; end_gps_lat/lng let admin (web) manually validate the
          // meeting by matching start GPS to end GPS. **STILL PLANNED — NOT
          // migrated to Supabase yet**, confirmed absent from the live schema
          // 2026-07-16 (this is why B-011 was found — the mapping fix above
          // doesn't help these two, they need an actual ALTER TABLE).
          end_gps_lat: number | null;
          end_gps_lng: number | null;
          created_at: string;
          // Migration 038 Part B (Migration-038-Report.md lines 83-104):
          // stamped server-side by the `stamp_meeting_cycle` trigger, only
          // when inserted by the client's CURRENT owner — late-arriving
          // meetings from a previous owner/cycle stay permanently
          // uncorrelated to any cycle (`cycle_id` null), by design.
          cycle_id: string | null;
          // Stable agenda ids, additive alongside the legacy `agenda`
          // display-label array above — never used as display text.
          agenda_ids: string[] | null;
        };
        Insert: Omit<Database['public']['Tables']['meetings']['Row'], 'id' | 'created_at' | 'cycle_id'>;
        Update: Partial<Database['public']['Tables']['meetings']['Insert']>;
        Relationships: [];
      };
      // T-014 (ADR-022 #11): drafted in Migration-015-Report.md, NOT yet
      // applied to Supabase (same "drafted, not yet applied" convention as
      // `normalized_company_name` above — Migration 014). Pushes against
      // this table will 404 until Vince applies that migration; the audit
      // outbox row just waits/retries like any other row.
      sync_audit_log: {
        Row: {
          id: string;
          device_op_id: string;
          user_id: string;
          device_id: string;
          entity_table: string;
          entity_id: string;
          operation: 'insert' | 'update' | 'delete' | 'upload';
          outcome:
            | 'synced'
            | 'failed'
            | 'conflict'
            | 'conflict_resolved_rename'
            | 'conflict_resolved_adopt_server'
            | 'lww_overwrite_applied';
          attempt_count: number;
          error_code: string | null;
          error_detail: Record<string, unknown> | null;
          occurred_at: string;
          recorded_at: string;
        };
        Insert: Omit<Database['public']['Tables']['sync_audit_log']['Row'], 'id' | 'recorded_at'>;
        Update: Partial<Database['public']['Tables']['sync_audit_log']['Insert']>;
        Relationships: [];
      };
      profiles: {
        Row: {
          id: string;
          user_id: string;
          email: string | null;
          full_name: string;
          role: string;
          team_id: string | null;
          is_active: boolean;
          created_at: string | null;
          // Live since web Migration 012 (2026-07-14) — public `avatars`
          // Storage bucket + column, RLS-restricted UPDATE to this column
          // (+ full_name) only. See ADR-029 (2026-07-20) for the mobile sync.
          avatar_url: string | null;
        };
        Insert: Omit<Database['public']['Tables']['profiles']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['profiles']['Insert']>;
        Relationships: [];
      };
      // ADR-030 / Migration 019 (DRAFTED, NOT yet applied — see
      // Migration-019-Report.md; Vince must live-verify the two flagged RLS
      // items before applying). Shape mirrors the SQL in that report exactly
      // — do not invent a parallel shape.
      tag_along_requests: {
        Row: {
          id: string;
          context: RemoteTagAlongContext;
          requester_id: string;
          invitee_id: string;
          invitee_kind: RemoteTagAlongInviteeKind;
          related_client_id: string | null;
          related_meeting_id: string | null;
          status: RemoteTagAlongStatus;
          created_at: string;
          responded_at: string | null;
          updated_at: string;
        };
        Insert: Omit<
          Database['public']['Tables']['tag_along_requests']['Row'],
          'id' | 'created_at' | 'updated_at' | 'status' | 'responded_at'
        >;
        Update: Partial<Database['public']['Tables']['tag_along_requests']['Insert']> & {
          status?: RemoteTagAlongStatus;
          responded_at?: string | null;
          // ADR-030 Pass 3: invitee accept/decline (updateCompanionRequestStatus,
          // lib/tag-along-invitee-service.ts) also re-stamps updated_at.
          updated_at?: string;
        };
        Relationships: [];
      };
      // ADR-041 / Migration 035 (Migration-035-Report.md): generalized
      // per-client ownership-cycle history. ⚠️ Live RLS is admin-only read
      // (`"Admin read client cycles" ... using (public.is_admin())`,
      // Migration-035-Report.md line 58) — no non-admin mobile role can
      // currently SELECT this table; see lib/db.ts's v14 migration comment
      // and lib/sync/policy-sync-down.ts for the flagged gap. Declared here
      // anyway so a typed `.from('client_cycles')` call is ready the moment
      // a scoped policy is added.
      client_cycles: {
        Row: {
          id: string;
          client_id: string;
          owner_id: string;
          started_at: string;
          ended_at: string | null;
          end_reason: RemoteClientCycleEndReason | null;
          lost_at: string | null;
          reassignable_at: string | null;
          claimed_by: string | null;
          claimed_at: string | null;
          agenda_policy_version: number | null;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['client_cycles']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['client_cycles']['Insert']>;
        Relationships: [];
      };
      // ADR-045 / Migration 038 Part D (Migration-038-Report.md lines
      // 179-234): "Authenticated read ..." RLS — every signed-in mobile role
      // can SELECT the full table, unfiltered (Admin-only write via a
      // separate policy, not exercised by mobile).
      agenda_policy_versions: {
        Row: {
          policy_version: number;
          effective_date: string;
          is_current: boolean;
          created_by: string | null;
          notes: string | null;
        };
        Insert: Omit<Database['public']['Tables']['agenda_policy_versions']['Row'], 'effective_date' | 'is_current'> & {
          effective_date?: string;
          is_current?: boolean;
        };
        Update: Partial<Database['public']['Tables']['agenda_policy_versions']['Insert']>;
        Relationships: [];
      };
      agenda_catalog: {
        Row: {
          agenda_id: string;
          policy_version: number;
          display_label: string;
          progress_weight: number;
          progress_override: number | null;
          is_active: boolean;
          sort_order: number;
        };
        Insert: Database['public']['Tables']['agenda_catalog']['Row'];
        Update: Partial<Database['public']['Tables']['agenda_catalog']['Insert']>;
        Relationships: [];
      };
      agenda_stage_rules: {
        Row: {
          agenda_id: string;
          policy_version: number;
          stage: RemoteAgendaStage;
          is_visible: boolean;
        };
        Insert: Database['public']['Tables']['agenda_stage_rules']['Row'];
        Update: Partial<Database['public']['Tables']['agenda_stage_rules']['Insert']>;
        Relationships: [];
      };
      // ADR-044 / Migration 039 (Migration-039-Report.md lines 32-46): no
      // dedicated create-RPC — "Agents create own PO confirmation" is a
      // direct RLS-gated INSERT policy (line 58), decisions go through
      // `decide_po_confirmation()` only (line 77).
      po_confirmation_requests: {
        Row: {
          id: string;
          client_id: string;
          cycle_id: string;
          meeting_id: string;
          requester_id: string;
          po_photo_path: string;
          status: RemotePoConfirmationStatus;
          decided_by: string | null;
          decided_at: string | null;
          decision_note: string | null;
          created_at: string;
          updated_at: string;
        };
        // Client-generated `id` sent explicitly (same B-041/B-044 lesson as
        // `tag_along_requests` above) — status/decision fields are
        // server-defaulted/only ever set via decide_po_confirmation().
        Insert: Omit<
          Database['public']['Tables']['po_confirmation_requests']['Row'],
          'status' | 'decided_by' | 'decided_at' | 'decision_note' | 'created_at' | 'updated_at'
        >;
        Update: Partial<Database['public']['Tables']['po_confirmation_requests']['Insert']>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    // Batch 2 (2026-07-26): both RPCs are SECURITY DEFINER, live on Supabase.
    // is_company_name_available: Migration 014 (2026-07-16). get_company_directory:
    // Migration 030 (2026-07-26) — see Migration-030-Report.md.
    Functions: {
      is_company_name_available: {
        Args: { p_name: string; p_city: string | null };
        Returns: boolean;
      };
      get_company_directory: {
        Args: Record<string, never>;
        Returns: {
          id: string;
          company_name: string;
          normalized_company_name: string;
          city: string | null;
        }[];
      };
      // ADR-044 / Migration 039 (Migration-039-Report.md lines 80-113):
      // idempotent CAS decision — `code` is one of 'invalid_decision',
      // 'not_found', 'role_not_eligible', 'already_decided', 'approved',
      // 'rejected'. `p_note` defaults to null server-side.
      decide_po_confirmation: {
        Args: { p_request_id: string; p_decision: string; p_note?: string | null };
        Returns: { ok: boolean; code: string };
      };
      // Migration 042 (Migration-042-Report.md lines 33-52): SECURITY
      // INVOKER — RLS on the underlying tables does the authorization work,
      // this RPC just reshapes. `summary` shape depends on `request_kind`
      // (po_confirmation: po_photo_path/meeting_id; tag_along:
      // invitee_kind/context) — narrow it at the call site.
      get_manager_approval_feed: {
        Args: Record<string, never>;
        Returns: {
          request_kind: RemoteApprovalRequestKind;
          request_id: string;
          requester_id: string;
          client_id: string;
          status: string;
          created_at: string;
          decided_at: string | null;
          summary: Record<string, unknown>;
        }[];
      };
      // Migration 042 (Migration-042-Report.md lines 54-71): same row shape,
      // scoped to `requester_id = current_profile_id()`.
      get_my_request_statuses: {
        Args: Record<string, never>;
        Returns: {
          request_kind: RemoteApprovalRequestKind;
          request_id: string;
          client_id: string;
          status: string;
          created_at: string;
          decided_at: string | null;
          summary: Record<string, unknown>;
        }[];
      };
      // Migration 038 Part C, PATCHED live by Migration 044 (2026-07-28 P0
      // security hotfix — see Migration-044-Report.md lines 122-176). Same
      // signature as originally shipped; `code` is one of the
      // ReassignResponseCode values in
      // lib/policies/reassignment-response-policy.ts.
      reassign_team_client: {
        Args: {
          p_client_id: string;
          p_new_agent_id: string;
          p_expected_current_agent_id: string;
          p_reason: string;
        };
        Returns: { ok: boolean; code: string; client?: Record<string, unknown> };
      };
      // Migration 037 (Migration-037-Report.md lines 36-131) — atomic
      // compare-and-swap claim. `code` is one of the LostOpportunityClaimCode
      // values in lib/policies/lost-opportunity-claim-policy.ts.
      claim_lost_opportunity: {
        Args: { p_client_id: string };
        Returns: { ok: boolean; code: string; client?: Record<string, unknown> };
      };
    };
    Enums: Record<string, never>;
  };
};
