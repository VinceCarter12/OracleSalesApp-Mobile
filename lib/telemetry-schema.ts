import type { FailureClass } from './sync/outbox-status';
import type { PolicyErrorId } from './policies/identifiers';

// Batch 1 (ADR-036/ADR-037): types only, no runtime logic, no server calls,
// no side effects. Nothing in this file is wired to a live sender yet.
//
// Redaction is structural: no field on any event here may ever carry client
// names, GPS coordinates, photo URLs, or free-text payloads — only counts,
// durations, and closed-enum classifications are allowed. Adding any
// free-text/PII-capable field requires a new ADR.

export interface TelemetryEventBase {
  eventId: string;
  deviceId: string;
  occurredAt: string;
  appVersion: string;
}

export interface SyncCycleTelemetry extends TelemetryEventBase {
  kind: 'sync_cycle';
  pushed: number;
  pulled: number;
  failed: number;
  failureClasses: Partial<Record<FailureClass, number>>;
  durationMs: number;
}

export interface PolicyCheckTelemetry extends TelemetryEventBase {
  kind: 'policy_check';
  errorId: PolicyErrorId;
  count: number;
}

export type TelemetryEvent = SyncCycleTelemetry | PolicyCheckTelemetry;
