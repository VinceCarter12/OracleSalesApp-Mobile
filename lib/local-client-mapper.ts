import type { Client, ClientStatus, SalesChannel } from '../types';

// Local SQLite already stores values in mobile's domain format (unlike
// Supabase rows — see lib/mappers.ts::toClient() for that boundary), so this
// mapping is a straight field pick, no value translation needed.

export interface LocalClientRow {
  id: string;
  company_name: string;
  contact_person: string | null;
  position: string | null;
  contact_number: string | null;
  office_address: string | null;
  sales_channel: string | null;
  status: string | null;
  agent_id: string;
  created_at: string;
  updated_at: string;
  details_deadline_at: string | null;
  sync_status: string;
  // Optional: `SELECT *` already returns this column (lib/db.ts v14), but a
  // pre-v14 in-memory row shape (or a caller building a partial row by hand)
  // may omit it — never assume present.
  cycle_id?: string | null;
  // Batch 4 (lib/db.ts v20): permanent client office pin, distinct from
  // meeting GPS evidence — see [[Office-Location-Spec-2026-07-29]]. Optional
  // for the same pre-migration-row reason as `cycle_id` above.
  office_lat?: number | null;
  office_lng?: number | null;
  office_pin_updated_at?: string | null;
  office_pin_source?: 'manual' | 'client_office_meeting' | null;
  // ADR-052 (Batch 6 Phase 5, lib/db.ts v21): approval-EXEMPT field, written
  // directly via `updateClientInfo()`. Optional for the same pre-migration
  // reason as `cycle_id`/`office_lat` above.
  minor_notes?: string | null;
}

export function rowToClient(row: LocalClientRow): Client {
  return {
    id: row.id,
    company_name: row.company_name,
    contact_person: row.contact_person ?? '',
    position: row.position,
    contact_number: row.contact_number,
    office_address: row.office_address,
    customer_type: 'Dealer',
    sales_channel: (row.sales_channel as SalesChannel | null) ?? 'Distributor',
    status: row.status as ClientStatus | null,
    agent_id: row.agent_id,
    created_at: row.created_at,
    updated_at: row.updated_at,
    details_deadline_at: row.details_deadline_at,
    sync_status: row.sync_status,
    cycle_id: row.cycle_id ?? null,
    office_lat: row.office_lat ?? null,
    office_lng: row.office_lng ?? null,
    office_pin_updated_at: row.office_pin_updated_at ?? null,
    office_pin_source: row.office_pin_source ?? null,
    minor_notes: row.minor_notes ?? null,
  };
}
