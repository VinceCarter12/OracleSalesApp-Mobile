import { supabase } from './supabase';
import { withTimeout } from './with-timeout';
import { isLikelyOnline } from './sync/connectivity';
import type { LostOpportunityDeclareCode } from './policies/lost-opportunity-declare-policy';

// Migration 088 (`declare_client_lost()`): Complete Info's "Declare lost
// opportunity" action. Every eligibility/pending-request predicate is
// evaluated server-side; this function only relays the RPC's `code`.
// Online-only, no SQLite write and no outbox row — this is a direct
// authoritative write, same pattern as claimLostOpportunity()/
// reassignTeamClient() (both online-only, ADR-041/050 precedent).
export const DECLARE_CLIENT_LOST_TIMEOUT_MS = 15000;

const DECLARE_CODES: readonly LostOpportunityDeclareCode[] = [
  'declared',
  'reason_required',
  'not_found',
  'role_not_eligible',
  'already_lost',
  'pending_edit_request',
  'pending_po_confirmation',
];

function decodeDeclareRpcResult(value: unknown): LostOpportunityDeclareCode {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error("Can't verify the declare-lost response from the server.");
  }
  const result = value as Record<string, unknown>;
  if (
    typeof result.code !== 'string' ||
    !DECLARE_CODES.includes(result.code as LostOpportunityDeclareCode)
  ) {
    throw new Error("Can't verify the declare-lost response from the server.");
  }
  return result.code as LostOpportunityDeclareCode;
}

/**
 * Calls `declare_client_lost()` (Migration 088). Requires internet — throws
 * if offline, same as `claimLostOpportunity()`.
 */
export async function declareClientLost(
  clientId: string,
  reason: string
): Promise<LostOpportunityDeclareCode> {
  const online = await isLikelyOnline();
  if (!online) {
    throw new Error('You need an internet connection to declare this client lost.');
  }

  const { data, error } = await withTimeout(
    Promise.resolve(
      supabase.rpc('declare_client_lost', { p_client_id: clientId, p_reason: reason })
    ),
    DECLARE_CLIENT_LOST_TIMEOUT_MS,
    'declareClientLost'
  );

  if (error) throw error;
  return decodeDeclareRpcResult(data);
}
