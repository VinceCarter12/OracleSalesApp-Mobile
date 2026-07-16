// Real remote value sets, sourced directly from
// supabase/migrations/001_initial.sql + 013_mobile_two_phase_lifecycle_and_address.sql
// (fetched from Cedie99/OracleSalesApp-Web 2026-07-15) — NOT mobile's own
// domain types (`CustomerType`/`SalesChannel`/`ClientStatus` in `./index`),
// which use different names/casing for different concepts. See ADR-018's
// 2026-07-15 revision and lib/remote-client-mapping.ts for the translation.
export type RemoteCustomerType = 'existing' | 'new' | 'prospect';
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
          // Real column name, confirmed via PostgREST introspection
          // (2026-07-15) — NOT `agent_id`, unlike `meetings`.
          assigned_agent_id: string;
          // Generated column from Migration 014 (drafted, not yet applied —
          // see Migration-014-Report.md). Queries against it will error
          // (column doesn't exist) until Vince applies the migration; T-005's
          // duplicate check catches that and falls back to local-only checks.
          normalized_company_name: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<
          Database['public']['Tables']['clients']['Row'],
          'id' | 'created_at' | 'updated_at' | 'normalized_company_name' | 'lost_at' | 'reassignable_at'
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
        };
        Insert: Omit<Database['public']['Tables']['meetings']['Row'], 'id' | 'created_at'>;
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
        };
        Insert: Omit<Database['public']['Tables']['profiles']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['profiles']['Insert']>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
  };
};
