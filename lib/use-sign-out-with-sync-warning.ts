import { useCallback, useState } from 'react';
import { getOutboxCounts, runSync } from './sync-engine';
import type { UserRole } from '../types';
import { resolveInitialDialog, resolveSyncResultDialog, type SignOutDialogVariant } from './sign-out-dialog-policy';

export type { SignOutDialogVariant } from './sign-out-dialog-policy';

export interface SignOutWithSyncWarningOptions {
  profileId: string | null;
  teamId: string | null;
  role: UserRole | null;
  completeSignOut: () => Promise<void>;
}

export interface SignOutSyncWarningDialogProps {
  visible: boolean;
  variant: SignOutDialogVariant | null;
  syncing: boolean;
  onDismiss: () => void;
  onSyncNow: () => void;
  onSignOut: () => void;
}

export interface UseSignOutWithSyncWarningResult {
  requestSignOut: (options: SignOutWithSyncWarningOptions) => Promise<void>;
  dialogProps: SignOutSyncWarningDialogProps;
}

/**
 * Owns the state machine for the sign-out sync-warning dialog. Business
 * logic (outbox check, sync run, sign-out) is unchanged from the old
 * imperative `requestSignOutWithSyncWarning` — only the presentation moved
 * from `Alert.alert` to a themed Modal (`SignOutSyncWarningDialog`).
 */
export function useSignOutWithSyncWarning(): UseSignOutWithSyncWarningResult {
  const [variant, setVariant] = useState<SignOutDialogVariant | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [options, setOptions] = useState<SignOutWithSyncWarningOptions | null>(null);

  const requestSignOut = useCallback(async (nextOptions: SignOutWithSyncWarningOptions): Promise<void> => {
    setOptions(nextOptions);
    try {
      const counts = await getOutboxCounts();
      setVariant(resolveInitialDialog(counts));
    } catch {
      setVariant({ kind: 'check-failed' });
    }
  }, []);

  const onDismiss = useCallback((): void => {
    setVariant(null);
  }, []);

  const onSignOut = useCallback((): void => {
    if (!options) return;
    void (async () => {
      try {
        await options.completeSignOut();
        setVariant(null);
      } catch (error) {
        setVariant({ kind: 'sign-out-failed', message: error instanceof Error ? error.message : 'Please try again.' });
      }
    })();
  }, [options]);

  const onSyncNow = useCallback((): void => {
    const activeOptions = options;
    const profileId = activeOptions?.profileId;
    if (!activeOptions || !profileId) {
      setVariant({ kind: 'sync-unavailable' });
      return;
    }
    setSyncing(true);
    void (async () => {
      await runSync(profileId, activeOptions.teamId, activeOptions.role);
      const remaining = await getOutboxCounts();
      setSyncing(false);
      setVariant(resolveSyncResultDialog(remaining));
    })();
  }, [options]);

  return {
    requestSignOut,
    dialogProps: { visible: variant !== null, variant, syncing, onDismiss, onSyncNow, onSignOut },
  };
}
