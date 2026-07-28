import { isValidMeetingForQuota } from './meeting-session-policy';
import type { QuotaPolicyId } from './identifiers';
import type { Meeting, UserRole } from '../../types';

// Batch 1 (ADR-036) scaffolding: `dailyTarget` is always supplied by a
// future Admin-configured `QuotaPolicyConfig` — this module must never
// hardcode a quota number (RSR's current 12/day, the historical 16/35
// figures discussed pre-ADR-037, or any other literal). Zero numeric quota
// literals in this file, by design.

export interface QuotaPolicyConfig {
  policyId: QuotaPolicyId;
  role: Extract<UserRole, 'rsr' | 'sales_specialist'>;
  /** Supplied by future Admin config — never a hardcoded literal in this file. */
  dailyTarget: number;
  effectiveFrom: string;
}

/** Returns the configured daily target for a role, or null when unconfigured or the role has no quota. */
export function getQuotaTarget(role: UserRole, config: QuotaPolicyConfig | null): number | null {
  if (config === null) return null;
  if (config.role !== role) return null;
  return config.dailyTarget;
}

/**
 * Delegates the per-meeting day/mode check to isValidMeetingForQuota, then
 * additionally excludes any meeting still gated by a pending MANAGER
 * tag-along (ADR-046 correction addendum: `validity_status ===
 * 'pending_confirmation'`, set at creation by
 * lib/meeting-service.ts::createMeeting, cleared on sync-down by
 * lib/tag-along-validity-service.ts). A pending TEAMMATE tag-along, or no
 * tag-along at all, never sets that status — those meetings count normally.
 * Missing `validity_status` (a stale local row read before SQLite v15 ran)
 * defaults to counted-as-valid, same as the column's own SQL DEFAULT.
 */
export function countValidMeetingsForQuota(
  meetings: readonly Pick<Meeting, 'meeting_mode' | 'logged_at' | 'validity_status'>[],
  onDayIso: string
): number {
  return meetings.filter(
    (meeting) => isValidMeetingForQuota(meeting, onDayIso) && meeting.validity_status !== 'pending_confirmation'
  ).length;
}
