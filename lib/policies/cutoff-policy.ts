import { isFastPathEligible } from '../client-status';
import type { Client, MeetingMode, MeetingOutcome, MeetingValidityStatus, UserRole } from '../../types';

// Batch 7C (ADR-053): Admin-configured cutoff/quota engine for the NEW
// feature only. Deliberately separate from lib/policies/quota-policy.ts
// (the legacy RSR daily-visits path, ADR-036/037) — that module stays
// untouched. NEVER import RSR_DAILY_VISIT_QUOTA or any hardcoded literal
// here; every numeric target/cap must come from an Admin-configured policy
// object, and an absent policy is always a distinct "unconfigured" result,
// never a silent fallback to zero or a hardcoded default (ADR-053 O-6).
//
// AMBIGUITY FLAGGED FOR REVIEW (see Batch 7C completion report): ADR-053's
// "Outcome-based counting" rule (point 12) names Successful, Follow-up
// Required, and Rescheduled as countable, and No Show/Abandoned/Incomplete
// as excluded. The live `MeetingOutcome` union (types/index.ts,
// MEETING_OUTCOMES) is only `'Successful' | 'Follow-up Required' |
// 'No Decision' | 'Lost Opportunity'` — there is no 'Rescheduled' or
// 'No Show' outcome value anywhere in this codebase today. This module
// treats 'Successful' and 'Follow-up Required' as the countable subset of
// the outcomes that actually exist, and 'No Decision'/'Lost Opportunity' as
// non-countable — the closest faithful mapping onto the real enum — but the
// exact 'Rescheduled'/'No Show' semantics cannot be implemented until
// Batch 7B either adds those outcome values or clarifies the mapping.

/** Roles that receive an independently configured quota target (ADR-053 O-6). Manager has no personal quota in this batch. */
export type CutoffQuotaRole = Extract<UserRole, 'sales_specialist' | 'rsr'>;

export interface CutoffPeriod {
  id: string;
  /** Inclusive ISO date (or datetime) bounds — Admin-defined, arbitrary range, never assumed calendar-month/semi-month (contract item 1). */
  startsAt: string;
  endsAt: string;
}

export interface CutoffRoleQuotaTarget {
  periodId: string;
  role: CutoffQuotaRole;
  /** Admin-configured — never a literal default. */
  target: number;
}

export interface CutoffClientCapConfig {
  periodId: string;
  /** Present only when Admin configured a per-role override; absent means the shared/global cap applies to every role (O-6). */
  role: CutoffQuotaRole | null;
  /** Admin-configured — never a literal default (contract item 2). */
  cap: number;
}

/** ADR-053 O-5: the five distinguishable Admin-reporting buckets, reused as the mobile-side provisional classification. */
export const CUTOFF_CLASSIFICATIONS = [
  'counted',
  'pending_validity',
  'over_cap',
  'excluded_invalid',
  'excluded_uncapped',
  'unattributed',
] as const;
export type CutoffClassification = (typeof CUTOFF_CLASSIFICATIONS)[number];

export interface CutoffMeetingInput {
  id: string;
  /** Needed to group meetings into per-client cap pools (O-2/O-3) — the shared/global quota summary aggregates across every client the agent owns. */
  clientId: string;
  /** O-1: start_captured_at is the canonical attribution timestamp, never logged_at. */
  startCapturedAtIso: string | null;
  /** Client lifecycle stage captured at meeting start (per the architecture recommendation to freeze attribution) — never re-derived from the client's CURRENT status. */
  clientStatusAtStart: Client['status'];
  outcome: MeetingOutcome | null;
  meetingMode: MeetingMode | undefined;
  validityStatus: MeetingValidityStatus | undefined;
  /** True once the outcome's required evidence (photos/GPS/etc.) is actually attached — a meeting can have a countable outcome value and still lack evidence (e.g. an interrupted save). */
  hasRequiredEvidence: boolean;
  /** True for a manager tag-along request that was explicitly declined — excluded/invalid forever, never over_cap (O-4). */
  tagAlongDeclined: boolean;
  /** True for a locally-detected duplicate record — excluded/invalid (ADR-053 point 5 catalog). */
  isDuplicate: boolean;
}

/**
 * Date-range period matching (contract item 1) — NOT calendar-day matching
 * like the legacy quota-policy.ts. Returns null (unattributed, O-10) when no
 * period covers the given timestamp; never guesses or back-dates to the
 * nearest period.
 */
export function findActiveCutoffPeriod(periods: readonly CutoffPeriod[], atIso: string): CutoffPeriod | null {
  const atMs = new Date(atIso).getTime();
  if (Number.isNaN(atMs)) return null;
  return (
    periods.find((period) => {
      const startMs = new Date(period.startsAt).getTime();
      const endMs = new Date(period.endsAt).getTime();
      return atMs >= startMs && atMs <= endMs;
    }) ?? null
  );
}

/**
 * Per-role quota target lookup (O-6). Sales Specialist and RSR are
 * independently configured — this NEVER falls back to the other role's
 * target, a shared/global number, or a hardcoded literal. Returns null
 * (explicit "no policy configured for this role") when nothing matches.
 */
export function getRoleQuotaTarget(
  role: CutoffQuotaRole,
  periodId: string,
  targets: readonly CutoffRoleQuotaTarget[]
): number | null {
  const match = targets.find((t) => t.periodId === periodId && t.role === role);
  return match ? match.target : null;
}

/**
 * Per-client New/Existing meeting cap (O-6): role-specific override wins if
 * Admin configured one, otherwise the shared/global cap for the period.
 * Returns null when neither exists — "no cap configured" is distinct from
 * "cap is 0" and must never be treated as a silent zero.
 */
export function getClientCap(
  role: CutoffQuotaRole,
  periodId: string,
  caps: readonly CutoffClientCapConfig[]
): number | null {
  const roleSpecific = caps.find((c) => c.periodId === periodId && c.role === role);
  if (roleSpecific) return roleSpecific.cap;
  const shared = caps.find((c) => c.periodId === periodId && c.role === null);
  return shared ? shared.cap : null;
}

/**
 * Outcome-based counting validity (ADR-053 point 12, mapped onto the real
 * MeetingOutcome enum — see the file-header ambiguity note). Requires valid
 * required evidence; a countable outcome alone is not sufficient.
 */
const COUNTABLE_OUTCOMES: readonly MeetingOutcome[] = ['Successful', 'Follow-up Required'];

function hasCountableOutcome(meeting: Pick<CutoffMeetingInput, 'outcome' | 'hasRequiredEvidence'>): boolean {
  if (!meeting.outcome) return false;
  return COUNTABLE_OUTCOMES.includes(meeting.outcome) && meeting.hasRequiredEvidence;
}

/**
 * Online meetings now count toward this NEW feature's quota/cap (supersedes
 * the legacy ADR-012 in-person-only rule, which stays as-is for the OLD
 * widget only — see lib/policies/meeting-session-policy.ts's own
 * isValidMeetingForQuota, which this module deliberately does NOT reuse for
 * the online-exclusion behavior, per the task's explicit instruction).
 */
function isInvalidRegardlessOfCap(meeting: CutoffMeetingInput): boolean {
  if (meeting.tagAlongDeclined) return true;
  if (meeting.isDuplicate) return true;
  if (meeting.validityStatus === 'pending_confirmation') return false; // pending, not invalid — handled separately
  return !hasCountableOutcome(meeting);
}

/**
 * Classifies every meeting for ONE client's shared New/Existing cap pool
 * (O-2/O-3: one pool across new+existing, over-cap meetings excluded from
 * both the per-client allowance and the period quota but preserved).
 * Processes meetings in start_captured_at order — first-attribution-wins,
 * matching the server's own atomic rule (ADR-053 "Server-Authoritative
 * Architecture"); this is a PROVISIONAL local approximation only, the
 * server's decision on sync-down is always authoritative.
 */
export function classifyClientMeetings(
  meetings: readonly CutoffMeetingInput[],
  periods: readonly CutoffPeriod[],
  role: CutoffQuotaRole,
  caps: readonly CutoffClientCapConfig[]
): Map<string, CutoffClassification> {
  const result = new Map<string, CutoffClassification>();

  const ordered = [...meetings].sort((a, b) => {
    const aMs = a.startCapturedAtIso ? new Date(a.startCapturedAtIso).getTime() : Infinity;
    const bMs = b.startCapturedAtIso ? new Date(b.startCapturedAtIso).getTime() : Infinity;
    return aMs - bMs;
  });

  const usedByPeriod = new Map<string, number>();

  for (const meeting of ordered) {
    if (!meeting.startCapturedAtIso) {
      result.set(meeting.id, 'unattributed');
      continue;
    }
    const period = findActiveCutoffPeriod(periods, meeting.startCapturedAtIso);
    if (!period) {
      result.set(meeting.id, 'unattributed');
      continue;
    }
    if (meeting.validityStatus === 'pending_confirmation') {
      result.set(meeting.id, 'pending_validity');
      continue;
    }
    if (isInvalidRegardlessOfCap(meeting)) {
      result.set(meeting.id, 'excluded_invalid');
      continue;
    }

    const isCapped = isFastPathEligible({ status: meeting.clientStatusAtStart });
    if (!isCapped) {
      result.set(meeting.id, 'excluded_uncapped');
      continue;
    }

    const cap = getClientCap(role, period.id, caps);
    if (cap === null) {
      // No cap configured — treated as uncapped for this pool rather than
      // silently blocking counting (never invent a fallback cap number).
      result.set(meeting.id, 'counted');
      continue;
    }

    const usedKey = `${period.id}`;
    const used = usedByPeriod.get(usedKey) ?? 0;
    if (used >= cap) {
      result.set(meeting.id, 'over_cap');
      continue;
    }
    usedByPeriod.set(usedKey, used + 1);
    result.set(meeting.id, 'counted');
  }

  return result;
}

export interface CutoffPeriodUsage {
  period: CutoffPeriod;
  /** Explicit null when no policy is configured for this role — never a hardcoded fallback (O-6). */
  target: number | null;
  confirmedCount: number;
  pendingCount: number;
}

/** Aggregate period-quota usage (confirmed vs. pending, kept separate per O-8 — never merged into one number). */
export function summarizeCutoffQuota(
  meetings: readonly CutoffMeetingInput[],
  periods: readonly CutoffPeriod[],
  role: CutoffQuotaRole,
  targets: readonly CutoffRoleQuotaTarget[],
  caps: readonly CutoffClientCapConfig[],
  nowIso: string
): CutoffPeriodUsage | null {
  const activePeriod = findActiveCutoffPeriod(periods, nowIso);
  if (!activePeriod) return null;

  const target = getRoleQuotaTarget(role, activePeriod.id, targets);

  // Classification is per-client (the cap pool is per-client), so group by
  // client before classifying, then roll the results back up for the
  // period-wide quota count.
  const byClient = new Map<string, CutoffMeetingInput[]>();
  for (const meeting of meetings) {
    const bucket = byClient.get(meeting.clientId) ?? [];
    bucket.push(meeting);
    byClient.set(meeting.clientId, bucket);
  }

  let confirmedCount = 0;
  let pendingCount = 0;
  for (const bucket of byClient.values()) {
    const classified = classifyClientMeetings(bucket, periods, role, caps);
    for (const meeting of bucket) {
      const classification = classified.get(meeting.id);
      if (classification === 'counted') confirmedCount += 1;
      if (classification === 'pending_validity') pendingCount += 1;
    }
  }

  return { period: activePeriod, target, confirmedCount, pendingCount };
}
