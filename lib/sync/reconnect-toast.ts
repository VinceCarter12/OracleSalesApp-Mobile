import type { ConnectivityState } from './connectivity';

// Vince's explicit product decision (2026-08-16): the "X record(s) synced
// online." toast fires ONLY on a genuine offline→online reconnect that
// actually pushed something — never on a routine already-online sync pass
// (e.g. saving one meeting while connected must stay silent here). Kept as
// pure functions (no React, no lib/toast.ts import) so this is testable
// under this repo's Node-only Vitest environment (see vitest.config.ts).
// lib/use-sync.ts's sync() callback wires these in, tracking the previous
// pass's `SyncResult.connectivity` (lib/sync-engine.ts) in a ref that resets
// to null whenever `agentId` changes (fresh login/account switch), so a new
// session never fires the toast off a stale prior-session connectivity read.

/**
 * True only when: the immediately-preceding known pass was `'offline'`
 * (link-level, not `'no_internet'`/`'backend_unreachable'`/`'auth_required'`
 * — those aren't a genuine reconnect signal by themselves), this pass is
 * `'online'`, and this pass actually synced at least one record.
 */
export function shouldShowReconnectToast(
  previousConnectivity: ConnectivityState | null,
  currentConnectivity: ConnectivityState,
  synced: number
): boolean {
  return previousConnectivity === 'offline' && currentConnectivity === 'online' && synced > 0;
}

/** Singular "record" for 1, plural "records" otherwise — e.g. "1 record synced online." / "3 records synced online." */
export function formatReconnectToastMessage(synced: number): string {
  return `${synced} record${synced === 1 ? '' : 's'} synced online.`;
}
