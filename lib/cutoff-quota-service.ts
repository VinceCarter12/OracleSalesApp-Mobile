import { getDb } from './db';
import type { CutoffQuotaRole } from './policies/cutoff-policy';
import { isDateWithinInclusiveRange, manilaCalendarDate } from './manila-calendar';
import { isQualifyingLocalMeeting, type MeetingCandidateRow } from './policies/cutoff-local-qualification';

// Batch 7C (ADR-053): read-only local access to the LIVE cutoff/quota
// snapshot mirrors (lib/db.ts SQLite v23), populated by
// lib/sync/cutoff-sync-down.ts whenever `cutoff_quota_v1` is ON. Every
// function here resolves to the explicit "unconfigured"/"no active period"
// result (null / null target) rather than throwing or fabricating a
// zero-value card — both because the server itself returns nulls for that
// case (`get_my_cutoff_usage_summary`/`get_client_cutoff_allowance`) and
// because, as of 2026-08-02, NO cutoff period has been seeded yet, so this
// is the real, current, expected state in production, not just a test edge
// case.

export interface CutoffQuotaCardData {
  periodLabel: string;
  /** Null when the server has no target configured for this agent's role (O-6) — never a hardcoded fallback. */
  target: number | null;
  confirmedCount: number;
  /** Locally-computed count of not-yet-synced qualifying meetings — kept as a SEPARATE number from confirmedCount, never merged (O-8). */
  pendingCount: number;
}

export interface CutoffClientAllowanceData {
  periodLabel: string;
  usedCount: number;
  cap: number | null;
}

interface RoleUsageRow {
  period_id: string | null;
  period_label: string | null;
  starts_on: string | null;
  ends_on: string | null;
  target: number | null;
  confirmed_count: number | null;
}


/**
 * Counts this agent's not-yet-synced (`sync_status != 'synced'`) qualifying
 * meetings whose `start_captured_at` falls within the given period — the
 * local half of the confirmed/pending split (O-8). The server-confirmed
 * `confirmed_count` from `get_my_cutoff_usage_summary()` already reflects
 * everything that's synced; this only covers what the phone hasn't pushed
 * yet, so the two numbers are never double-counted. In Progress Close deal
 * meetings additionally require a PO confirmation that has been submitted;
 * its Manager approval/rejection status does not affect this local count.
 */
async function countPendingQualifyingMeetings(
  agentId: string,
  startsOn: string,
  endsOn: string
): Promise<number> {
  const db = await getDb();
  const rows = await db.getAllAsync<MeetingCandidateRow>(
    `SELECT m.id, m.outcome, m.agendas, m.client_status_at_meeting,
            m.start_photo_url, m.end_photo_url, m.start_captured_at,
            (SELECT p.status
               FROM po_confirmation_requests p
              WHERE p.meeting_id = m.id
              ORDER BY p.created_at DESC
              LIMIT 1) AS po_confirmation_status
     FROM meetings m
     WHERE m.agent_id = ?
       AND m.sync_status != 'synced'
       AND m.start_captured_at IS NOT NULL`,
    [agentId]
  );
  return rows.filter((row) => {
    if (!isQualifyingLocalMeeting(row)) return false;
    if (!row.start_captured_at) return false;
    const localDate = manilaCalendarDate(row.start_captured_at);
    return isDateWithinInclusiveRange(localDate, startsOn, endsOn);
  }).length;
}

function formatPeriodLabel(label: string | null, startsOn: string | null, endsOn: string | null): string {
  if (label) return label;
  if (startsOn && endsOn) {
    return `${new Date(startsOn).toLocaleDateString()} – ${new Date(endsOn).toLocaleDateString()}`;
  }
  return '';
}

/**
 * Role-scoped quota card data (W-1). Returns null when no active period is
 * synced OR no usage row exists for this agent — the caller renders the
 * "No quota configured" state in that case, never a hardcoded fallback
 * (O-6). `role` is accepted for the caller's own display/gating purposes;
 * the server RPC itself is implicit on the caller's session role, so this
 * does not filter by it directly.
 */
export async function getCutoffQuotaCard(agentId: string, _role: CutoffQuotaRole): Promise<CutoffQuotaCardData | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<RoleUsageRow>(
    'SELECT period_id, period_label, starts_on, ends_on, target, confirmed_count FROM cutoff_role_usage_snapshot WHERE agent_id = ?',
    [agentId]
  );
  if (!row || !row.period_id || !row.starts_on || !row.ends_on) return null;

  const pendingCount = await countPendingQualifyingMeetings(agentId, row.starts_on, row.ends_on);

  return {
    periodLabel: formatPeriodLabel(row.period_label, row.starts_on, row.ends_on),
    target: row.target,
    confirmedCount: row.confirmed_count ?? 0,
    pendingCount,
  };
}

/**
 * Per-client allowance data (W-2/W-4/W-5/W-6). Returns null when there's no
 * synced allowance row for this client (no active period, or the client
 * isn't new/existing — callers must ALSO gate on isFastPathEligible before
 * calling this, since prospect/in_progress clients never get a row by
 * design, contract item 3) or no cap is configured.
 */
export async function getCutoffClientAllowance(clientId: string): Promise<CutoffClientAllowanceData | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<{
    period_label: string | null;
    starts_on: string | null;
    ends_on: string | null;
    used: number | null;
    cap: number | null;
  }>(
    'SELECT period_label, starts_on, ends_on, used, cap FROM cutoff_client_allowance_snapshot WHERE client_id = ?',
    [clientId]
  );
  if (!row) return null;

  return {
    periodLabel: formatPeriodLabel(row.period_label, row.starts_on, row.ends_on),
    usedCount: row.used ?? 0,
    cap: row.cap,
  };
}
