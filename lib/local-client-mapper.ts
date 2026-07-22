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
  };
}
