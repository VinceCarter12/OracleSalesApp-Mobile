import { supabase } from './supabase';
import { withTimeout } from './with-timeout';
import { isLikelyOnline } from './sync/connectivity';
import type { LostOpportunityClaimCode } from './policies/lost-opportunity-claim-policy';
import { decodeClaimRpcResult, parseFreshProspectId } from './lost-opportunity-claim-payload';
export { parseFreshProspectId } from './lost-opportunity-claim-payload';

// ADR-041 (Migration 037, Batch 3 Slice 6b): claimant-side RPC call for
// `claim_lost_opportunity()`.
//
// ⚠️ NOT wired into any screen yet. A pre-implementation wireframe check
// (hard project rule) found `Wireframe-Sales-BizLink.html` DOES have a Sales
// Lost Opportunities flow (`#a-lostopps` list + `#a-lostoppdetail` detail,
// including a real "Claim this opportunity" button at
// `aOpenLostOpportunity()` — see the wireframe's JS around
// `aClaimLostOpportunity(id)`), but the mobile app itself has NO equivalent
// screen for `sales_specialist`/`rsr` today — only
// `app/(executive)/more/lost-opportunity.tsx`, a company-wide, view-only
// Executive screen with no claim action (correct per ADR-039: managers/
// executives never claim/reassign/reserve/mutate). Building the Sales list +
// detail + office-map screen this wireframe section implies is a net-new
// screen, not "wire a Claim action into an existing screen" — out of scope
// for a single-call-site RPC switch, so this was flagged rather than built.
// This file exists so the RPC contract is ready the moment that screen is
// designed, same "ready but unwired" convention as
// lib/po-confirmation-manager-service.ts::getManagerApprovalFeed.

export const CLAIM_LOST_OPPORTUNITY_TIMEOUT_MS = 15000;

export interface ClaimLostOpportunityResult {
  code: LostOpportunityClaimCode;
  /** The fresh prospect returned by the replacement RPC (if successful). */
  clientId: string | null;
}


/**
 * Calls `claim_lost_opportunity()` (Migration 037). Every claimability
 * predicate — caller role, former-owner exclusion (permanent, across all
 * historical cycles), cooldown, already-claimed race-safety — is evaluated
 * server-side in a single atomic compare-and-swap; this function only
 * relays the RPC's `code`. Online-only (ADR-041 decision, no offline
 * queueing) — the same guard used by every other online-only mobile write
 * (e.g. lib/manager-client-service.ts::reassignClient).
 */
export async function claimLostOpportunity(clientId: string): Promise<ClaimLostOpportunityResult> {
  const online = await isLikelyOnline();
  if (!online) {
    throw new Error('You need an internet connection to claim a lost opportunity.');
  }

  const { data, error } = await withTimeout(
    Promise.resolve(
      supabase.rpc('claim_lost_opportunity', { p_client_id: clientId })
    ),
    CLAIM_LOST_OPPORTUNITY_TIMEOUT_MS,
    'claimLostOpportunity'
  );

  if (error) throw error;
  const decoded = decodeClaimRpcResult(data);
  const code = decoded.code as LostOpportunityClaimCode;
  if (code !== 'claimed') return { code, clientId: null };
  const freshClientId = parseFreshProspectId(decoded.client);
  if (!freshClientId) {
    throw new Error('The opportunity could not be claimed: the app needs a fresh prospect record from the server.');
  }
  return { code, clientId: freshClientId };
}
