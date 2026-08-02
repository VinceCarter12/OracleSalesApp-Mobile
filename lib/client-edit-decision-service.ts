import { supabase } from './supabase';

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
