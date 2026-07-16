import NetInfo from '@react-native-community/netinfo';
import { supabase } from '../supabase';
import { withTimeout } from '../with-timeout';

// T-014 (ADR-022 #3): a network/auth problem is not a per-record problem —
// runSync must tell "nothing is reachable" apart from "this row is bad"
// BEFORE touching any outbox row's retry_count/status. This fixes a real
// bug where auth-token expiry currently gets misclassified as a permanent
// per-record failure and dead-letters good records.

const REACHABILITY_TIMEOUT_MS = 4000;
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;

export type ConnectivityState =
  | 'offline'
  | 'no_internet'
  | 'backend_unreachable'
  | 'auth_required'
  | 'online';

/**
 * Three layers, in order: (a) NetInfo link-level state — no radio connection
 * at all. (b) A reachability probe against Supabase's own auth health
 * endpoint (no new backend work) — distinguishes "device thinks it has
 * internet but our backend is unreachable" from "device itself reports no
 * internet" using NetInfo's `isInternetReachable` alongside `isConnected`.
 * (c) Session validity — a live connection with an expired/missing session
 * is `auth_required`, not a data problem.
 */
export async function checkConnectivity(): Promise<ConnectivityState> {
  const netState = await NetInfo.fetch();
  if (!netState.isConnected) return 'offline';

  const deviceReportsNoInternet = netState.isInternetReachable === false;
  const backendReachable = await probeBackend();
  if (!backendReachable) return deviceReportsNoInternet ? 'no_internet' : 'backend_unreachable';

  const { data } = await supabase.auth.getSession();
  if (!data.session) return 'auth_required';

  return 'online';
}

async function probeBackend(): Promise<boolean> {
  if (!SUPABASE_URL) return false;
  try {
    await withTimeout(
      fetch(`${SUPABASE_URL}/auth/v1/health`, { method: 'GET' }),
      REACHABILITY_TIMEOUT_MS,
      'connectivity probe'
    );
    return true;
  } catch {
    return false;
  }
}
