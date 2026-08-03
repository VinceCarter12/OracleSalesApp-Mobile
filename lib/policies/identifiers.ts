// Batch 1 (ADR-036/ADR-037): stable contract IDs used across the policy
// modules in this directory. These are internal identifiers, NOT display
// labels — never render them directly in UI copy, and never rename one
// once shipped without treating it as a contract break (any server/telemetry
// consumer keyed off these strings would silently desync).

export const STAGE_IDS = ['prospect', 'in_progress', 'new', 'existing'] as const;
export const EVIDENCE_KINDS = ['gps', 'start_photo', 'end_photo', 'agenda', 'outcome'] as const;
export const QUOTA_POLICY_IDS = ['rsr_daily_visits', 'sales_periodic_visits'] as const;
export const ROLE_POLICY_IDS = ['agent_self', 'manager_team_scope'] as const;
export const POLICY_ERROR_IDS = [
  'stage_transition_invalid',
  'agenda_invalid_for_stage',
  'agenda_duplicate',
  'evidence_missing',
  'session_overdue',
  'session_abandoned',
  'quota_policy_unconfigured',
  'approval_not_permitted',
  // Batch 7C (ADR-053): new cutoff/quota feature error ids — additive only,
  // none of the ids above are renamed/removed.
  'cutoff_period_unconfigured',
  'cutoff_role_quota_unconfigured',
  'cutoff_client_cap_unconfigured',
] as const;

// Batch 7C (ADR-053): stable ids for the new per-role cutoff quota policy —
// separate id space from QUOTA_POLICY_IDS (the legacy RSR-only daily quota),
// since this is a distinct engine (lib/policies/cutoff-policy.ts), not an
// extension of the legacy one.
export const CUTOFF_QUOTA_POLICY_IDS = ['cutoff_sales_specialist_quota', 'cutoff_rsr_quota'] as const;

export type StageId = (typeof STAGE_IDS)[number];
export type EvidenceKind = (typeof EVIDENCE_KINDS)[number];
export type QuotaPolicyId = (typeof QUOTA_POLICY_IDS)[number];
export type RolePolicyId = (typeof ROLE_POLICY_IDS)[number];
export type PolicyErrorId = (typeof POLICY_ERROR_IDS)[number];
export type CutoffQuotaPolicyId = (typeof CUTOFF_QUOTA_POLICY_IDS)[number];
