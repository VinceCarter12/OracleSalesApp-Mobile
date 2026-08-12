// ADR-052 (Batch 6 Phase 5): pure payload-shaping logic split out of
// lib/client-edit-request-service.ts (which does the actual SQLite/outbox
// I/O) so it's directly unit-testable without a DB round-trip — same split
// pattern as lib/app-lock/bootstrap-decision.ts / account-status-classify.ts.

/** One changed field's before/after values, as the UI/caller supplies them. */
export interface ClientEditRequestFieldChange {
  old: unknown;
  new: unknown;
}

export type ClientEditRequestChanges = Record<string, ClientEditRequestFieldChange>;

export interface BuildClientEditRequestPayloadInput {
  id: string;
  clientId: string;
  requestedBy: string;
  changes: ClientEditRequestChanges;
  /**
   * CRITICAL (ADR-052 section D): must be the LOCAL clients row's
   * server-authoritative `updated_at`, NEVER `local_updated_at` — getting
   * this backwards causes every request to immediately fail as a false
   * `base_conflict` once `decide_client_edit_request()` runs, since the
   * server compares against its own `clients.updated_at`, which only
   * `updated_at` (not `local_updated_at`, which advances on every unsynced
   * local edit) actually mirrors.
   */
  baseUpdatedAt: string;
  /** The local clients row's current assigned agent (local column `agent_id`, remote `assigned_agent_id`) at request time. */
  baseAssignedAgentId: string;
}

/** Shape matching the live Supabase `client_edit_requests` table's writable columns (status/reviewed_by/reviewed_at/review_note are server-defaulted, never sent). */
export interface ClientEditRequestRemotePayload {
  id: string;
  client_id: string;
  requested_by: string;
  changes: ClientEditRequestChanges;
  base_updated_at: string;
  base_assigned_agent_id: string;
}

/** Pure: builds the exact remote payload shape sent through the outbox — no I/O, no side effects. */
export function buildClientEditRequestRemotePayload(
  input: BuildClientEditRequestPayloadInput
): ClientEditRequestRemotePayload {
  return {
    id: input.id,
    client_id: input.clientId,
    requested_by: input.requestedBy,
    changes: input.changes,
    base_updated_at: input.baseUpdatedAt,
    base_assigned_agent_id: input.baseAssignedAgentId,
  };
}

// Batch 6 PR D: `''` and `null` must compare equal — otherwise every
// untouched-but-blank field (e.g. an office_address never filled in) would
// look "dirty" the moment the form round-trips it through a controlled
// TextInput (which always yields `''`, never `null`). `undefined` is also
// folded in so a caller that omits a key entirely behaves the same as one
// that supplies an explicit blank. Exported (per-field approval gating,
// 2026-08-11) so lib/complete-info-submit.ts's blank-before-value check
// uses this exact same '' / null / undefined equivalence rather than
// reimplementing it.
export function normalizeForCompare(value: unknown): unknown {
  return value === '' || value === null || value === undefined ? null : value;
}

/**
 * Diffs `before`/`after` over `allowlist` only, normalizing blank
 * representations first (see `normalizeForCompare`). Returns an empty
 * object — never a request — when nothing in the allowlist actually
 * changed; callers (`app/(tabs)/clients/complete.tsx`) rely on this
 * short-circuit to decide whether a `client_edit_requests` row is needed
 * at all.
 */
export function computeClientEditChanges(
  before: Readonly<Record<string, unknown>>,
  after: Readonly<Record<string, unknown>>,
  allowlist: readonly string[]
): ClientEditRequestChanges {
  const changes: ClientEditRequestChanges = {};
  for (const field of allowlist) {
    const oldValue = before[field];
    const newValue = after[field];
    if (normalizeForCompare(oldValue) === normalizeForCompare(newValue)) continue;
    changes[field] = { old: oldValue, new: newValue };
  }
  return changes;
}
