import { supabase } from './supabase';
import type { ClientEditConflictDetail } from './policies/approval-decision-outcome';

// ADR-052 section D (2026-08-01 correction, migration 056, confirmed live
// 2026-08-02): `decide_client_edit_request()` — SECURITY DEFINER, idempotent
// compare-and-set, same shape as `lib/po-confirmation-manager-service.ts`'s
// `decidePoConfirmation()` in spirit but returns a PLAIN TEXT code directly
// (not an `{ ok, code }` object) — see types/database.ts's
// `decide_client_edit_request` Functions entry.

export type ClientEditDecisionCode =
  | 'approved'
  | 'rejected'
  | 'invalid_decision'
  | 'not_found'
  | 'role_not_eligible'
  | 'already_decided'
  | 'base_conflict';

const KNOWN_DECISION_CODES: readonly ClientEditDecisionCode[] = [
  'approved',
  'rejected',
  'invalid_decision',
  'not_found',
  'role_not_eligible',
  'already_decided',
  'base_conflict',
];

function isClientEditDecisionCode(value: string): value is ClientEditDecisionCode {
  return (KNOWN_DECISION_CODES as readonly string[]).includes(value);
}

/** Thrown only when the RPC responds with something outside the documented code set — a real "the server and this build have drifted" bug, distinct from every documented domain outcome above (none of which throw). */
export class UnknownClientEditDecisionCodeError extends Error {
  constructor(code: unknown) {
    super(`decide_client_edit_request() returned an unrecognized code: ${String(code)}`);
    this.name = 'UnknownClientEditDecisionCodeError';
  }
}

/**
 * Calls `decide_client_edit_request()`. Every documented outcome — including
 * failure codes like `'already_decided'`/`'base_conflict'`/`'role_not_eligible'`
 * — is returned as a value, never thrown; only a transport failure (network/
 * auth error from `supabase.rpc()`) or a genuinely unrecognized response
 * throws. Callers (the approvals detail screen) own mapping each code to UX
 * per ADR-052 section E.
 */
export async function decideClientEditRequest(
  requestId: string,
  decision: 'approved' | 'rejected',
  note: string | null
): Promise<ClientEditDecisionCode> {
  const { data, error } = await supabase.rpc('decide_client_edit_request', {
    p_request_id: requestId,
    p_decision: decision,
    p_note: note,
  });
  if (error) throw error;
  if (typeof data !== 'string' || !isClientEditDecisionCode(data)) {
    throw new UnknownClientEditDecisionCodeError(data);
  }
  return data;
}

/**
 * Why a `'base_conflict'` happened — migration 128's read-only companion RPC.
 *
 * Call this ONLY after `decideClientEditRequest()` returned `'base_conflict'`.
 * That code covers three unrelated conditions (reassignment, a lost client, a
 * per-field mismatch) and cannot be split without breaking this file's own
 * `KNOWN_DECISION_CODES` check on every shipped build, so the detail arrives
 * out of band instead.
 *
 * Returns `null` rather than throwing on ANY failure — transport, permission,
 * or an unrecognized shape. This is a copy-improving lookup on a path that has
 * already failed; losing the better sentence is acceptable, turning a handled
 * refusal into an unhandled crash is not. `describeConflictReason(null)` falls
 * back to the generic wording.
 */
export async function fetchClientEditConflictDetail(
  requestId: string
): Promise<ClientEditConflictDetail | null> {
  try {
    const { data, error } = await supabase.rpc('explain_client_edit_conflict', {
      p_request_id: requestId,
    });
    if (error || !data || typeof data !== 'object' || Array.isArray(data)) return null;
    const detail = data as ClientEditConflictDetail;
    return typeof detail.reason === 'string' ? detail : null;
  } catch {
    return null;
  }
}

export interface ClientEditBulkFailure {
  requestId: string;
  /** A documented decision code, or 'transport_error' when `supabase.rpc()` itself failed. */
  code: ClientEditDecisionCode | 'transport_error';
  /**
   * Populated only for `'base_conflict'`, and only when the lookup succeeded.
   * Lets the bulk toast say WHICH conflict rather than repeating one generic
   * line for several unrelated causes.
   */
  conflictDetail?: ClientEditConflictDetail | null;
}

export interface ClientEditBulkResult {
  approved: string[];
  failures: ClientEditBulkFailure[];
}

/**
 * Approve several client-edit requests — the Manager Requests inbox's bulk
 * action (`app/(manager)/approvals/index.tsx`).
 *
 * There is no bulk RPC and this deliberately does not add one.
 * `decide_client_edit_request()` re-checks the base-conflict, reassignment and
 * lost-client guards per request against the CURRENT client row, and those
 * checks are the whole reason a stale request must not be applied. A set-based
 * RPC would either duplicate that logic or skip it. So a bulk approve is N
 * independent decisions, each free to refuse on its own.
 *
 * That makes PARTIAL SUCCESS the normal outcome, not an edge case: an admin
 * approving one from web's /approvals a second earlier yields
 * 'already_decided', and an agent editing the client since yields
 * 'base_conflict'. Both lists come back and the caller must report both —
 * silently claiming "7 approved" when 5 landed is the failure worth avoiding.
 *
 * Sequential, not `Promise.all`: each call takes a row lock and then writes
 * `public.clients`, and two requests from the same agent frequently target the
 * SAME client. Firing those concurrently has them racing to read the base
 * value the other is about to change, turning a clean 'base_conflict' into an
 * order-dependent one. A batch here is at most a screenful.
 *
 * Never throws for a domain outcome — matching `decideClientEditRequest()`
 * above. A transport failure on one request is recorded as that request's
 * failure and the run CONTINUES, because a dropped connection mid-batch must
 * not silently abandon the requests after it.
 */
export async function approveClientEditRequests(requestIds: readonly string[]): Promise<ClientEditBulkResult> {
  const approved: string[] = [];
  const failures: ClientEditBulkFailure[] = [];

  for (const requestId of requestIds) {
    try {
      const code = await decideClientEditRequest(requestId, 'approved', null);
      if (code === 'approved') {
        approved.push(requestId);
      } else if (code === 'base_conflict') {
        // One extra round-trip, on the failure path only. Sequential like the
        // decisions themselves, for the same reason.
        failures.push({ requestId, code, conflictDetail: await fetchClientEditConflictDetail(requestId) });
      } else {
        failures.push({ requestId, code });
      }
    } catch {
      failures.push({ requestId, code: 'transport_error' });
    }
  }

  return { approved, failures };
}
