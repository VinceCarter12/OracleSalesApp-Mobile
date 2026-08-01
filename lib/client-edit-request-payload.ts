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
