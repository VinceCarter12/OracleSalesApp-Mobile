export type ConnectivityState =
  | 'offline'
  | 'no_internet'
  | 'backend_unreachable'
  | 'auth_required'
  | 'online';

/**
 * Whether a `ConnectivityState` should read as "you're offline — connect and
 * try again" to a user, vs. a real server/auth failure that deserves its own
 * error message. `'backend_unreachable'` and `'auth_required'` are NOT
 * "offline" — telling a user to "connect to the internet" when the real
 * problem is a server outage or an expired session would be misleading.
 *
 * Split out of `connectivity.ts` (deliberately) — that file imports
 * `NetInfo`/`supabase`, which can't be parsed by this repo's Node-only
 * Vitest setup, so this pure logic lives on its own to stay unit-testable.
 */
export function isOfflineState(state: ConnectivityState): boolean {
  return state === 'offline' || state === 'no_internet';
}
