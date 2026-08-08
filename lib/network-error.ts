/**
 * B-087: RN's fetch (and supabase-js on top of it) normalizes DNS/radio-level
 * failures (e.g. Android `UnknownHostException` on a transient DNS blip) to
 * generic `TypeError: Network request failed`-style messages — there is no
 * reliable per-cause code to switch on. Used to tell "the device/network
 * dropped mid-call" (expected under ADR-001 offline-first, already safe to
 * retry next sync pass) apart from a genuinely unexpected failure (bad
 * response shape, auth misconfig, etc.) that a caller should still log loudly.
 *
 * Kept dependency-free (no RN/native-module imports) so it stays testable
 * under vitest's plain node environment (see vitest.config.ts) — unlike
 * lib/sync/connectivity.ts, which pulls in NetInfo.
 */
export function isNetworkConnectivityError(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err);
  return (
    err instanceof TypeError ||
    /network request failed|unable to resolve host|unknownhostexception|fetch failed|timed out after/i.test(message)
  );
}
