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

// ADR-052 (Batch 6 Phase 5, 2026-08-01): domain-specific client-edit approval
// table — mirrors po_confirmation_requests' structural precedent above.
// Only 'pending'/'approved'/'rejected' are valid remotely; mobile's own
// local-only 'superseded' status (a non-retryable outbox push failure, e.g.
// 403 RLS rejection or 23505 duplicate-pending, see lib/sync/outbox-status.ts)
// never leaves the device, so it is NOT part of this remote-shape union.
export type RemoteClientEditRequestStatus = 'pending' | 'approved' | 'rejected';

// Migration 042 (Migration-042-Report.md): the literal UNIONed by both
// `get_manager_approval_feed()` and `get_my_request_statuses()` —
// ADR-046 correction addendum point 3 is explicit that this is
// 'po_confirmation', never the shorthand 'po'. ADR-052 (Batch 6, migrations
// 053-056, confirmed live 2026-08-02) extends both RPCs' UNION with a third
// 'client_edit' kind sourced from `client_edit_requests` — see
// `lib/manager-approval-feed-service.ts`.
export type RemoteApprovalRequestKind = 'po_confirmation' | 'tag_along' | 'client_edit';

// F-007 Collection & Delivery (web migrations 043/044/045/046, deployed
// 2026-07-28). Lowercase remote value sets — mobile's display casing
// ('Cash'/etc.) is applied at render time (lib/collection-delivery-data.ts).
// 'partial' (web 070): a collection with at least one payment but the running
// total still below `amount_due` — stays open and re-lists until fully paid.
export type RemoteCollectionStatus = 'collected' | 'rescheduled' | 'pending' | 'partial';
// NOTE (F-007): 'delivery_receipt' requires the web DB `payment_method` CHECK
// constraint to be widened to accept it — otherwise the outbox push is rejected.
export type RemotePaymentMethod = 'cash' | 'check' | 'gcash' | 'counter' | 'delivery_receipt';
// 'partial' (web 073): a COD delivery handed over but with the COD paid down over
// installments — stays open until the running COD total reaches cod_due.
export type RemotePurchaseOrderStatus = 'pending' | 'delivered' | 'failed' | 'partial';
export type RemoteCodMethod = 'cash' | 'check' | 'gcash';
// Remittances (043 collection / 044 COD). Collection remits to office / bayad
// center / bank; COD delivery remits to office only (no destination column).
export type RemoteRemittanceStatus = 'submitted' | 'reconciled' | 'variance';
export type RemoteRemitDestination = 'office' | 'bayad_center' | 'bank_deposit';

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
          // Batch 4 (2026-07-29): permanent client office pin, additive
          // columns on the shared web+mobile `clients` table — see
          // [[Office-Location-Spec-2026-07-29]]. Distinct from any
          // meeting's own GPS evidence (`meetings.gps_lat`/`gps_lng`).
          // Written only via `lib/office-pin-service.ts`.
          office_lat: number | null;
          office_lng: number | null;
          office_pin_updated_at: string | null;
          office_pin_source: 'manual' | 'client_office_meeting' | null;
          // ADR-052 (Batch 6 Phase 5, Migration File B — additive,
          // `ALTER TABLE clients ADD COLUMN IF NOT EXISTS minor_notes TEXT`).
          // The one CLIENT_EDITABLE_FIELDS entry that is approval-EXEMPT — set
          // directly via `updateClientInfo()`, never via a `client_edit_requests`
          // row (lib/policies/approval-policy.ts).
          minor_notes: string | null;
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
          // B-095 fix (2026-08-08): the client's lifecycle status frozen at
          // the moment this meeting was recorded — see lib/db.ts's local
          // Migration v26 + Bugs.md. Companion web-repo migration
          // (`supabase/migrations/067_meetings_client_status_at_meeting.sql`,
          // renumbered from the originally-drafted 064) applied & CI-deployed
          // live 2026-08-08 — this column round-trips normally now.
          client_status_at_meeting: string | null;
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
      // ADR-052 (Batch 6 Phase 5, Migration File A — table backfill, NOT yet
      // pushed to the web repo as of 2026-08-01, proceeding per the approved
      // phased rollout since this schema-consuming mobile code stays inert
      // until the table exists live). No dedicated create-RPC — Sales/RSR
      // INSERT directly (RLS-gated, offline-queueable via the outbox);
      // decisions go through `decide_client_edit_request()` only.
      client_edit_requests: {
        Row: {
          id: string;
          client_id: string;
          requested_by: string;
          changes: Record<string, { old: unknown; new: unknown }>;
          status: RemoteClientEditRequestStatus;
          reviewed_by: string | null;
          reviewed_at: string | null;
          review_note: string | null;
          base_updated_at: string;
          base_assigned_agent_id: string;
          created_at: string;
          updated_at: string;
        };
        // Client-generated `id` sent explicitly (same B-041/B-044 lesson as
        // `tag_along_requests`/`po_confirmation_requests` above) —
        // status/decision fields are server-defaulted/only ever set via
        // decide_client_edit_request().
        Insert: Omit<
          Database['public']['Tables']['client_edit_requests']['Row'],
          'status' | 'reviewed_by' | 'reviewed_at' | 'review_note' | 'created_at' | 'updated_at'
        >;
        Update: Partial<Database['public']['Tables']['client_edit_requests']['Insert']>;
        Relationships: [];
      };
      // F-007 Collection module — migrations 043 (base) + 045 (client_name/area)
      // + 046 (claimed_by/claimed_at/claimed_by_name). Field roles read the
      // whole day's list; `client_name`/`area`/`claimed_by_name` are
      // denormalized because collectors have no RLS read on clients/profiles.
      collection_visits: {
        Row: {
          id: string;
          client_id: string;
          status: RemoteCollectionStatus;
          scheduled_for: string;
          listed_by: string | null;
          listed_at: string;
          amount_due: number;
          collector_id: string | null;
          amount_collected: number | null;
          payment_method: RemotePaymentMethod | null;
          payment_photo_url: string | null;
          delivery_receipt_photo_url: string | null;
          gps_lat: number | null;
          gps_lng: number | null;
          remarks: string | null;
          rescheduled_to: string | null;
          visited_at: string | null;
          created_at: string;
          updated_at: string;
          // 045 — denormalized customer identity (point-in-time copy).
          client_name: string | null;
          area: string | null;
          // 046 — en-route claim ("On the way"). NOT collector_id (who worked it).
          claimed_by: string | null;
          claimed_at: string | null;
          claimed_by_name: string | null;
          // 068 — Additional Collection: a store added to an already-published
          // day list. `is_additional` badges + floats it; the two ack timestamps
          // are stamped write-once via the RPCs below (mobile can't UPDATE them
          // directly — RLS rejects it, migration 069).
          is_additional: boolean;
          additional_received_at: string | null;
          additional_seen_at: string | null;
        };
        Insert: Partial<Database['public']['Tables']['collection_visits']['Row']>;
        Update: Partial<Database['public']['Tables']['collection_visits']['Row']>;
        Relationships: [];
      };
      // F-007 Partial payment (web migration 070): one row per cash handover
      // against a visit. Collector RLS is INSERT + SELECT own only (no UPDATE),
      // so proof URLs go IN the insert; a roll-up trigger sums these onto the
      // parent visit's amount_collected/status.
      collection_payments: {
        Row: {
          id: string;
          visit_id: string;
          collector_id: string;
          amount: number;
          payment_method: RemotePaymentMethod;
          payment_photo_url: string | null;
          delivery_receipt_photo_url: string | null;
          gps_lat: number | null;
          gps_lng: number | null;
          remarks: string | null;
          paid_at: string;
          created_at: string;
        };
        Insert: Partial<Database['public']['Tables']['collection_payments']['Row']>;
        Update: Partial<Database['public']['Tables']['collection_payments']['Row']>;
        Relationships: [];
      };
      // F-007 Delivery partial COD (web 073). One row per COD handover toward a
      // PO; the parent PO's cod_amount/status is the roll-up (rollup_cod_payment
      // trigger). Driver RLS is INSERT + SELECT-own only (no UPDATE), so the
      // payment photo URL rides IN the insert — same pattern as collection_payments.
      cod_payments: {
        Row: {
          id: string;
          po_id: string;
          driver_id: string;
          amount: number;
          payment_method: RemoteCodMethod;
          payment_photo_url: string | null;
          gps_lat: number | null;
          gps_lng: number | null;
          remarks: string | null;
          paid_at: string;
          created_at: string;
        };
        Insert: Partial<Database['public']['Tables']['cod_payments']['Row']>;
        Update: Partial<Database['public']['Tables']['cod_payments']['Row']>;
        Relationships: [];
      };
      // F-007 Delivery module — migrations 044 (base) + 045 (client_name) + 046
      // (claim columns). `area` is admin-entered on the PO (044), so 045 only
      // added client_name here.
      purchase_orders: {
        Row: {
          id: string;
          po_number: string;
          client_id: string;
          area: string;
          status: RemotePurchaseOrderStatus;
          scheduled_for: string;
          listed_by: string | null;
          listed_at: string;
          cod: boolean;
          cod_due: number | null;
          driver_id: string | null;
          truck_plate: string | null;
          sequence_no: number | null;
          receiver_name: string | null;
          receiver_signature_url: string | null;
          time_in: string | null;
          time_out: string | null;
          proof_url: string | null;
          backload_photo_url: string | null;
          gps_lat: number | null;
          gps_lng: number | null;
          remarks: string | null;
          cod_amount: number | null;
          cod_method: RemoteCodMethod | null;
          cod_photo_url: string | null;
          cod_remitted: boolean;
          created_at: string;
          updated_at: string;
          client_name: string | null;
          claimed_by: string | null;
          claimed_at: string | null;
          claimed_by_name: string | null;
        };
        Insert: Partial<Database['public']['Tables']['purchase_orders']['Row']>;
        Update: Partial<Database['public']['Tables']['purchase_orders']['Row']>;
        Relationships: [];
      };
      // F-007 Collection remittance (043). Collector INSERTs own; no UPDATE
      // policy, so photo URLs (signed_proof_url/receiver_signature_url) must be
      // present in the insert, not patched later. `visit_ids` is a UUID[] of the
      // collection_visits this remittance covers.
      remittances: {
        Row: {
          id: string;
          collector_id: string;
          destination: RemoteRemitDestination;
          amount_remitted: number;
          amount_collected: number;
          status: RemoteRemittanceStatus;
          receiver_name: string | null;
          signed_proof_url: string | null;
          receiver_signature_url: string | null;
          visit_ids: string[];
          submitted_at: string;
          created_at: string;
        };
        Insert: Partial<Database['public']['Tables']['remittances']['Row']>;
        Update: Partial<Database['public']['Tables']['remittances']['Row']>;
        Relationships: [];
      };
      // F-007 COD delivery remittance (044). Driver INSERTs own; office-only (no
      // destination), no signed_proof_url. `receiver_name` is NOT NULL remotely.
      cod_remittances: {
        Row: {
          id: string;
          driver_id: string;
          amount_remitted: number;
          amount_collected: number;
          status: RemoteRemittanceStatus;
          receiver_name: string;
          receiver_signature_url: string | null;
          po_ids: string[];
          submitted_at: string;
          created_at: string;
        };
        Insert: Partial<Database['public']['Tables']['cod_remittances']['Row']>;
        Update: Partial<Database['public']['Tables']['cod_remittances']['Row']>;
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
      // Migration 069 — Additional Collection acknowledgment write-path.
      // Collector-only (42501 for any other role); write-once via COALESCE, so
      // idempotent — a retry / re-sync / second open is a harmless no-op.
      // Returns the stamped timestamptz, or null if the row wasn't additional.
      // A direct UPDATE on the columns is rejected by RLS (deliberate) — these
      // RPCs are the ONLY sanctioned write path.
      mark_additional_received: {
        Args: { p_visit_id: string };
        Returns: string | null;
      };
      mark_additional_seen: {
        Args: { p_visit_id: string };
        Returns: string | null;
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
      // ADR-052 section D (2026-08-01 correction, migration 056, confirmed
      // live 2026-08-02): idempotent CAS decision, same `p_request_id`/
      // `p_decision`/`p_note` argument shape as decide_po_confirmation()
      // above, but — per the recorded correction — returns a PLAIN TEXT
      // code directly (not an `{ ok, code }` object). One of
      // 'invalid_decision', 'not_found', 'role_not_eligible',
      // 'already_decided', 'base_conflict', 'approved', 'rejected'. See
      // lib/client-edit-decision-service.ts::ClientEditDecisionCode.
      decide_client_edit_request: {
        Args: { p_request_id: string; p_decision: string; p_note?: string | null };
        Returns: string;
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
      // ADR-053 / Migrations 057-060 (Batch 7B, live 2026-08-02): the
      // calling agent's own role-scoped usage against the active
      // `cutoff_periods` row. target/confirmed_count/remaining are all
      // independently nullable — no active period, or no target configured
      // for the caller's role. At most one row (implicit on caller's own
      // session/role, not parameterized).
      get_my_cutoff_usage_summary: {
        Args: Record<string, never>;
        Returns: {
          period_id: string | null;
          period_label: string | null;
          starts_on: string | null;
          ends_on: string | null;
          role: string;
          target: number | null;
          confirmed_count: number | null;
          remaining: number | null;
        }[];
      };
      // ADR-053 / Migrations 057-060 (Batch 7B, live 2026-08-02): one
      // client's New/Existing per-cutoff allowance. Returns no rows for
      // prospect/in_progress clients (uncapped stages) — correct behavior,
      // not a bug.
      get_client_cutoff_allowance: {
        Args: { p_client_id: string };
        Returns: {
          period_id: string | null;
          period_label: string | null;
          starts_on: string | null;
          ends_on: string | null;
          used: number | null;
          cap: number | null;
          remaining: number | null;
        }[];
      };
    };
    Enums: Record<string, never>;
  };
};
