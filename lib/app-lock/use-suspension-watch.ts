import { useEffect, useRef } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { useSession } from '../session-store';
import { verifyAccountActive } from './account-status';

/**
 * Batch 5 Slice 2 (ADR-051): two of the three suspension-check trigger
 * points —
 *   1. Foreground/resume (`background` -> `active` only; `inactive` fires
 *      for transient OS dialogs like permission prompts and would
 *      false-trigger).
 *   3. Post-cold-start-rehydration, non-blocking, once per app launch.
 * The third trigger point (sensitive writes) lives directly in
 * `lib/meeting-service.ts`/`lib/client-service.ts` — not here. Deliberately
 * kept separate from Slice 1's `useColdStartBootstrap()` rather than editing
 * that hook's internals, to minimize regression risk in already-shipped
 * Slice 1 code.
 */
export function useSuspensionWatch(): void {
  const { status, profileId, markSuspended } = useSession();
  const appStateRef = useRef(AppState.currentState);
  const rehydrationCheckedRef = useRef(false);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState: AppStateStatus) => {
      const previousState = appStateRef.current;
      appStateRef.current = nextState;
      if (previousState === 'background' && nextState === 'active' && profileId) {
        void checkAndMaybeSuspend(profileId, markSuspended);
      }
    });
    return () => subscription.remove();
  }, [profileId, markSuspended]);

  useEffect(() => {
    if (status !== 'signed_in' || !profileId || rehydrationCheckedRef.current) return;
    rehydrationCheckedRef.current = true;
    void checkAndMaybeSuspend(profileId, markSuspended);
  }, [status, profileId, markSuspended]);
}

async function checkAndMaybeSuspend(profileId: string, markSuspended: () => void): Promise<void> {
  // 'active'/'unverified' are both no-ops here — Slice 3 will refresh the
  // snapshot on 'active'; 'unverified' fails open by design (ADR-051).
  const result = await verifyAccountActive(profileId);
  if (result === 'suspended') markSuspended();
}
