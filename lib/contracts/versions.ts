// Batch 1 (ADR-036/ADR-037) scaffolding — types only, no live consumer yet.
//
// TWO DISTINCT device-op-id mappings exist in this codebase; do not treat
// them as equivalent:
//   1. For business-entity outbox rows (clients/meetings/tag_along_requests),
//      `lib/sync/entity-registry.ts`'s `EnqueueOutboxRowInput.outboxId`
//      field IS the device-op-id for that row.
//   2. The `sync_audit` audit lane has its own, separately-named
//      `AuditRowInput.deviceOpId` field (`lib/sync/audit-log.ts`), used as
//      half of the remote `sync_audit_log` table's
//      `UNIQUE(device_op_id, outcome)` constraint.
// A future policy-version rollout that needs to correlate against either
// lane must pick the correct one explicitly — never assume one field name
// covers both.

export interface PolicyVersion {
  policyId: string;
  version: number;
  effectiveAt: string;
}

export interface AppVersionInfo {
  appVersion: string;
  buildNumber: string | null;
  policyVersions: readonly PolicyVersion[];
}
