import { useEffect } from 'react';
import { supabase } from '../supabase';
import { withTimeout } from '../with-timeout';
import { readSnapshot, clearSnapshot, type SessionSnapshot } from './session-snapshot';
import { decideBootstrapOutcome } from './bootstrap-decision';
import { useSession } from '../session-store';

const GET_SESSION_TIMEOUT_MS = 8000;

/**
 * Batch 5 Slice 1 (ADR-051): runs once on cold start, before RootNavigator
 * (app/_layout.tsx) evaluates any Stack.Protected guard — this is what lets
 * a valid persisted Supabase session skip the login screen instead of always
 * forcing re-login. Resolves session-store's 'bootstrapping' status to
 * either 'signed_in' (via rehydrate()) or 'signed_out'.
 *
 * Slice 2's suspension check (verifyAccountActive) is deliberately NOT
 * wired here — this hook is rehydration-only. The pure branching logic
 * lives in bootstrap-decision.ts (unit-tested there); this file is the I/O
 * shell around it.
 */
export function useColdStartBootstrap(): void {
  const { status, rehydrate, signOut } = useSession();

  useEffect(() => {
    if (status !== 'bootstrapping') return;
    void resolveBootstrap(rehydrate, signOut);
    // Runs exactly once per cold start — `status` itself guards re-entry
    // (it flips away from 'bootstrapping' as soon as this resolves), so this
    // effect must not re-run when rehydrate/signOut identities change.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- see comment above; guarded by the status !== 'bootstrapping' check.
  }, []);
}

async function resolveBootstrap(
  rehydrate: (snapshot: SessionSnapshot) => void,
  signOut: () => void
): Promise<void> {
  try {
    const { data } = await withTimeout(supabase.auth.getSession(), GET_SESSION_TIMEOUT_MS, 'coldStartGetSession');
    const sessionUserId = data.session?.user.id ?? null;
    const snapshot = sessionUserId ? await readSnapshot() : null;
    const decision = decideBootstrapOutcome(sessionUserId, snapshot);

    if (decision.kind === 'rehydrate') {
      rehydrate(decision.snapshot);
      return;
    }
    if (decision.shouldClearSnapshot) {
      await clearSnapshot();
    }
    signOut();
  } catch {
    // Timed-out/failed getSession() call — fail closed to signed_out rather
    // than guessing. Never blocks the app; the login screen is always a
    // safe fallback.
    signOut();
  }
}
