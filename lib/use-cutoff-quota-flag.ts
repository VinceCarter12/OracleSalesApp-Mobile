/**
 * Batch 7C (ADR-053): the `cutoff_quota_v1` staged-rollout gate applied
 * while Batch 7B's server-side schema/RPCs were unverified. That
 * verification is complete (2026-08-04, physical device) and the RSR-target
 * fix landed (Web PR #53 / migration 065) — every cutoff/quota UI surface
 * now renders unconditionally, same as CutoffQuotaCard already did per the
 * 2026-08-03 direction. This hook is kept only so PostRecordCutoffStatus and
 * ClientCutoffAllowanceBlock don't need a separate code path.
 */
export function useCutoffQuotaFlag(): boolean {
  return true;
}
