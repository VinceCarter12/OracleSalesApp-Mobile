import type { RemoteClientStatus, RemoteCustomerType, RemoteSalesChannel } from '../types/database';
import type { ClientStatus, SalesChannel } from '../types';

// T-005 correction (2026-07-15): mobile's own `status`/`customer_type` domain
// fields do NOT correspond 1:1 to Supabase's columns of the same/similar
// name — confirmed against the live migrations (Cedie99/OracleSalesApp-Web).
// Mobile's lifecycle value (prospect/new/existing) belongs in Supabase's
// `customer_type` column; Supabase's own `status` column is a separate,
// coarser active/inactive/lost/deleted flag, unrelated to mobile's legacy
// `customer_type` field (Dealer/Sub-Dealer/etc — never sent remotely).

const SALES_CHANNEL_TO_REMOTE: Record<SalesChannel, RemoteSalesChannel> = {
  Distributor: 'distributor',
  Dealer: 'dealer',
  'End-User': 'end_user',
  'Private Label': 'private_label',
};

const SALES_CHANNEL_FROM_REMOTE: Record<RemoteSalesChannel, SalesChannel> = {
  distributor: 'Distributor',
  dealer: 'Dealer',
  end_user: 'End-User',
  private_label: 'Private Label',
};

export function toRemoteSalesChannel(channel: SalesChannel): RemoteSalesChannel {
  return SALES_CHANNEL_TO_REMOTE[channel];
}

export function fromRemoteSalesChannel(channel: RemoteSalesChannel | null): SalesChannel {
  return channel ? SALES_CHANNEL_FROM_REMOTE[channel] : 'Distributor';
}

/** Mobile's 'inactive' is the only local status value with a direct remote-`status` counterpart; the rest live in `customer_type`. */
export function toRemoteCustomerType(status: ClientStatus | null | undefined): RemoteCustomerType {
  return status === 'new' || status === 'existing' ? status : 'prospect';
}

export function toRemoteStatus(status: ClientStatus | null | undefined): RemoteClientStatus {
  return status === 'inactive' ? 'inactive' : 'active';
}

/**
 * Reconstructs mobile's local lifecycle value from the two remote columns.
 * `lost`/`deleted` aren't yet represented in mobile's `ClientStatus` domain
 * type (CLIENT_STATUSES) — flagged as a follow-up, not silently mapped to
 * something misleading here.
 */
export function fromRemoteStatus(
  remoteStatus: RemoteClientStatus,
  customerType: RemoteCustomerType | null
): ClientStatus {
  if (remoteStatus === 'inactive') return 'inactive';
  return customerType ?? 'prospect';
}
