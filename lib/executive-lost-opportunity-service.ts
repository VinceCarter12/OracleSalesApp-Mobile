import { supabase } from './supabase';

// B-060 Executive sweep (2026-07-23): Lost Opportunity screen's real data
// source. Split into its own file rather than growing
// lib/executive-overview-service.ts past the 300-line file-length cap —
// genuinely separate read (company-wide `status='lost'` clients only, not
// part of the main overview's active-client set) with its own row shapes,
// following that file's same "unscoped live Supabase query, Executive device
// has no local mirror of company-wide data" reasoning.
//
// Status is DERIVED, not a real column (Vince-approved plan, 2026-07-23):
// `reassignable_at` (set by the web's `handle_lost_opportunity()` trigger,
// Database.md's cross-repo MAPS section) gives a 14-day cooldown before
// another agent can claim a lost client. `now < reassignable_at` → still on
// cooldown; `now >= reassignable_at` → released for other agents to claim.
//
// "Claimed by" deliberately NOT modeled: once another agent claims a lost
// client, the reassignment necessarily moves `status` away from `'lost'`
// (the client becomes active again under its new agent) — this query only
// ever sees clients still sitting in `status='lost'`, i.e. still unclaimed.
// There is no "claimed" state left to derive here, and no column tracks the
// ORIGINAL agent who lost the client (only current `assigned_agent_id`), so
// a "claimed by" field can't be reliably reconstructed even historically.
// The mock's third status (`'claimed'`) and `claimedBy` field are dropped,
// not guessed at.
//
// Reason field: `inactive_reason` (confirmed present on the live schema per
// Database.md's 2026-07-14 `information_schema.columns` verification), NOT
// `lost_source` (never confirmed present on the live schema or in
// `types/database.ts`'s stub — likely never applied). Using the column that
// is actually confirmed to exist and be populated by the manual
// Inactive→Lost-Opportunity flow.

const AGENT_ROLES = ['sales_specialist', 'rsr'] as const;
const MANAGER_ROLE = 'sales_manager';

export type ExecLostOpportunityStatus = 'cooldown' | 'released';

export interface ExecLostOpportunity {
  id: string;
  companyName: string;
  agentId: string;
  agentName: string | null;
  managerId: string | null;
  managerName: string | null;
  lostAt: string | null;
  reassignableAt: string | null;
  reason: string | null;
  status: ExecLostOpportunityStatus;
}

interface LostClientRow {
  id: string;
  company_name: string;
  assigned_agent_id: string;
  lost_at: string | null;
  reassignable_at: string | null;
  inactive_reason: string | null;
}

interface ProfileRow {
  id: string;
  full_name: string;
  role: string;
  team_id: string | null;
}

function deriveStatus(reassignableAt: string | null, now: Date): ExecLostOpportunityStatus {
  // No cooldown timestamp at all (shouldn't happen once the trigger has run,
  // but null-safe rather than assuming) — treat as still on cooldown, the
  // more conservative of the two states.
  if (!reassignableAt) return 'cooldown';
  return new Date(reassignableAt).getTime() <= now.getTime() ? 'released' : 'cooldown';
}

async function fetchLostClients(): Promise<LostClientRow[]> {
  const { data, error } = await supabase
    .from('clients')
    .select('id, company_name, assigned_agent_id, lost_at, reassignable_at, inactive_reason')
    .eq('status', 'lost');
  if (error) throw error;
  return (data ?? []) as LostClientRow[];
}

async function fetchAgentAndManagerProfiles(): Promise<ProfileRow[]> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name, role, team_id')
    .in('role', [...AGENT_ROLES, MANAGER_ROLE]);
  if (error) throw error;
  return (data ?? []) as ProfileRow[];
}

export async function fetchExecutiveLostOpportunities(): Promise<ExecLostOpportunity[]> {
  const [lostClients, profiles] = await Promise.all([fetchLostClients(), fetchAgentAndManagerProfiles()]);

  const agentById = new Map(profiles.map((p) => [p.id, p]));
  const managerByTeamId = new Map(
    profiles.filter((p) => p.role === MANAGER_ROLE && p.team_id).map((p) => [p.team_id as string, p])
  );

  const now = new Date();
  return lostClients.map((row) => {
    const agent = agentById.get(row.assigned_agent_id) ?? null;
    const manager = agent?.team_id ? managerByTeamId.get(agent.team_id) ?? null : null;
    return {
      id: row.id,
      companyName: row.company_name,
      agentId: row.assigned_agent_id,
      agentName: agent?.full_name ?? null,
      managerId: manager?.id ?? null,
      managerName: manager?.full_name ?? null,
      lostAt: row.lost_at,
      reassignableAt: row.reassignable_at,
      reason: row.inactive_reason,
      status: deriveStatus(row.reassignable_at, now),
    };
  });
}
