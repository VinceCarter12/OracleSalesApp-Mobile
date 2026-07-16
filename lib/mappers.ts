import type { Database } from '../types/database';
import type { Client } from '../types';
import { fromRemoteSalesChannel, fromRemoteStatus } from './remote-client-mapping';

/**
 * Maps a `clients` row straight off Supabase to the domain `Client` type.
 * Several remote column names/value sets differ from mobile's domain type,
 * confirmed against the live Supabase migrations (2026-07-15) — every read
 * boundary must go through this rather than casting the row directly:
 * `assigned_agent_id` (not `agent_id`), `contact_position` (not `position`),
 * `sales_channel` (lowercase/underscored remotely), and the lifecycle value
 * split across remote `customer_type` + `status` (see remote-client-mapping.ts).
 */
export function toClient(row: Database['public']['Tables']['clients']['Row']): Client {
  const { assigned_agent_id, contact_position, sales_channel, customer_type, status, ...rest } = row;
  return {
    ...rest,
    agent_id: assigned_agent_id,
    position: contact_position,
    sales_channel: fromRemoteSalesChannel(sales_channel),
    status: fromRemoteStatus(status, customer_type),
    // Mobile's own `customer_type` (Dealer/Sub-Dealer/etc) has no remote
    // counterpart — the remote column of the same name means something
    // different (see remote-client-mapping.ts). Legacy field, unused by any
    // real logic (types/index.ts); stubbed rather than left undefined.
    customer_type: 'Dealer',
  };
}
