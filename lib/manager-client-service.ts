import { supabase } from './supabase';
import { withTimeout } from './with-timeout';
import { isLikelyOnline } from './sync/connectivity';
import { initialsOf } from './team-remote-mappers';
import type { Database } from '../types/database';
import type { ReassignResponseCode } from './policies/reassignment-response-policy';

// B-054 Phase 1: the first real Manager WRITE path (client reassignment).
// Deliberately online-only — a manager's own device does not locally mirror
// team-wide clients at all (ADR-001 only mirrors the signed-in user's own
// rows), so there is nothing to write to locally and nothing for the offline
// outbox to enqueue against. Depends on Migration 022 (drafted, not yet
// applied live — see Migration-022-Report.md), which adds the
// "Managers reassign team clients" UPDATE policy this write relies on.

export const REASSIGN_TIMEOUT_MS = 15000;

export class ReassignConflictError extends Error {
  constructor() {
    super('This client was already reassigned to a different agent.');
    this.name = 'ReassignConflictError';
  }
}

export interface TeamAgentOption {
  id: string;
  fullName: string;
  initials: string;
  activeClients: number;
}

/**
 * Candidate agents a manager can reassign a client TO: the manager's own
 * team, excluding the client's current agent. Active-client counts are
 * computed client-side from a plain fetched list (kept simple — this pass
 * doesn't need a server-side aggregate).
 */
export async function fetchTeamReassignCandidates(
  teamId: string,
  excludeAgentProfileId: string
): Promise<TeamAgentOption[]> {
  const { data: profileRows, error: profileError } = await supabase
    .from('profiles')
    .select('id, full_name')
    .eq('team_id', teamId)
    .in('role', ['sales_specialist', 'rsr'])
    .neq('id', excludeAgentProfileId);
  if (profileError) throw profileError;
  const profiles = profileRows ?? [];
  if (profiles.length === 0) return [];

  const agentIds = profiles.map((p) => p.id);
  const { data: clientRows, error: clientError } = await supabase
    .from('clients')
    .select('assigned_agent_id, status')
    .in('assigned_agent_id', agentIds);
  if (clientError) throw clientError;
  const activeClients = (clientRows ?? []).filter((c) => c.status !== 'lost' && c.status !== 'deleted');

  return profiles.map((p) => ({
    id: p.id,
    fullName: p.full_name,
    initials: initialsOf(p.full_name),
    activeClients: activeClients.filter((c) => c.assigned_agent_id === p.id).length,
  }));
}

export interface ReassignClientInput {
  clientId: string;
  fromAgentProfileId: string;
  toAgentProfileId: string;
}

/**
 * Compare-and-swap UPDATE: the `.eq('assigned_agent_id', fromAgentProfileId)`
 * clause is B-043's safety mechanism — if the client was already reassigned
 * by someone else between load and submit, zero rows match and this throws
 * `ReassignConflictError` instead of silently overwriting a newer
 * reassignment. No separate pre-check is needed; the CAS itself is the guard.
 * Ownership is re-derived server-side from `auth.uid()` by Migration 022's
 * RLS policy — no `managerProfileId` parameter is needed here.
 */
export async function reassignClient(input: ReassignClientInput): Promise<void> {
  const online = await isLikelyOnline();
  if (!online) {
    throw new Error('Kailangan ng internet connection para mag-reassign ng client.');
  }

  const { data, error } = await withTimeout(
    Promise.resolve(
      supabase
        .from('clients')
        // `updated_at` is a real, insertable/updatable column on the live
        // `clients` table but is missing from the `Insert`/`Update` type
        // stubs (types/database.ts's documented "replace with generated
        // types" gap) — cast at this single call site, same established
        // pattern as lib/sync/remote-upsert.ts::updateOne().
        .update({
          assigned_agent_id: input.toAgentProfileId,
          updated_at: new Date().toISOString(),
        } as Database['public']['Tables']['clients']['Update'])
        .eq('id', input.clientId)
        .eq('assigned_agent_id', input.fromAgentProfileId)
        .select('id')
    ),
    REASSIGN_TIMEOUT_MS,
    'reassignClient'
  );

  if (error) throw error;
  if (!data || data.length === 0) {
    throw new ReassignConflictError();
  }
}

// ══════════════════════════════════════════════════════════════════════════
// ADR-043 / Migration 044 (Batch 3, Slice 6a) — `reassign_team_client()`,
// the RPC meant to REPLACE the bare CAS'd UPDATE above (Migration 038's own
// comment: "Replaces the bare UPDATE write path (lib/manager-client-service.ts)
// with an RPC that captures a mandatory reason and writes the audit event
// atomically"). This is the authorized, PATCHED (Migration 044, 2026-07-28)
// signature — adds manager/team-scope authorization on top of Migration
// 038's original CAS + reason check.
//
// The Manager BizLink `s-reassign` screen now captures the required reason and
// calls this RPC after agent selection. The server remains authoritative for
// team eligibility, CAS ownership, and the atomic reassignment audit event.
// ══════════════════════════════════════════════════════════════════════════

export interface ReassignTeamClientInput {
  clientId: string;
  fromAgentProfileId: string;
  toAgentProfileId: string;
  reason: string;
}

export interface ReassignTeamClientResult {
  code: ReassignResponseCode;
}

/**
 * Calls the patched `reassign_team_client()` RPC (Migration 044). Unlike the
 * older `reassignClient()` above, all authorization (caller must be the
 * outgoing owner's manager, new owner must be same-team/active/eligible),
 * the `reason_required`/`same_owner` guards, and the
 * `client_reassignment_events` audit insert happen server-side in one
 * transaction — this function only relays the RPC's `code`, it never assumes
 * an outcome client-side. Online-only (ADR-032, no offline queueing).
 */
export async function reassignTeamClient(
  input: ReassignTeamClientInput
): Promise<ReassignTeamClientResult> {
  const online = await isLikelyOnline();
  if (!online) {
    throw new Error('Kailangan ng internet connection para mag-reassign ng client.');
  }

  const { data, error } = await withTimeout(
    Promise.resolve(
      supabase.rpc('reassign_team_client', {
        p_client_id: input.clientId,
        p_new_agent_id: input.toAgentProfileId,
        p_expected_current_agent_id: input.fromAgentProfileId,
        p_reason: input.reason,
      })
    ),
    REASSIGN_TIMEOUT_MS,
    'reassignTeamClient'
  );

  if (error) throw error;
  return { code: data.code as ReassignResponseCode };
}
