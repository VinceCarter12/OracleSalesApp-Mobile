import { useCallback, useEffect, useRef, useState } from 'react';
import { getManagerNotificationFeedItems } from './manager-notification-feed-service';
import { getPoppedRequestIds, markRequestsPopped, resetPoppedRequestIds } from './manager-request-popup-store';
import { selectNewlyArrivedItems } from './manager-request-popup-selection';
import { subscribeSyncComplete } from './sync/sync-events';

export interface UseManagerRequestPopup {
  visible: boolean;
  newRequestCount: number;
  dismiss: () => void;
  viewRequests: () => void;
}

/**
 * Requirement D (2026-08-16, widened same day per Vince direct feedback; and
 * again 2026-08-16 for cadence + layout — see [[Sprint#2026-08-16]]): an
 * in-app banner for genuinely-still-pending requests (client_edit /
 * po_confirmation / tag_along), watermarked per-session so the same request
 * id doesn't re-pop twice within one session
 * (`lib/manager-request-popup-store.ts`). No push notifications involved.
 *
 * Evaluated on EVERY `subscribeSyncComplete` event (`lib/sync/sync-events.ts`
 * — fired after login's own initial sync, every foreground/idle/manual sync
 * pass, and reconnect) plus once on mount/profileId-becoming-available, so a
 * cold launch with an already-locally-synced pending request pops
 * immediately without waiting for a sync. The per-session watermark is what
 * keeps this from being noisy on routine sync ticks that found nothing new.
 * `isEvaluating` prevents two overlapping evaluations (e.g. the mount-time
 * check and an almost-simultaneous sync-complete) from both reading the
 * pre-watermark state and double-showing the same request.
 *
 * Cadence (once per cold start, once per sign-in, plus mid-session for
 * genuinely new arrivals) is enforced by resetting the watermark whenever
 * `profileId` changes to a new non-null value — a fresh process already
 * starts with an empty module-level watermark, so this effect only matters
 * for an in-process account switch.
 *
 * The auto-dismiss timer itself lives in `ManagerRequestPopupBanner.tsx`,
 * not here — same division of responsibility as
 * `components/sync/SyncUploadProgressCard.tsx`'s `usePushProgressPhase`,
 * which keeps its own dismiss timer local to the component rather than in
 * the underlying `lib/sync/sync-progress.ts` pub/sub. This hook only owns
 * the `visible`/`dismiss` state; the component decides when to call
 * `dismiss()`.
 */
export function useManagerRequestPopup(profileId: string | null, onViewRequests: () => void): UseManagerRequestPopup {
  const [visible, setVisible] = useState(false);
  const [newRequestCount, setNewRequestCount] = useState(0);
  const isEvaluating = useRef(false);

  useEffect(() => {
    if (profileId) resetPoppedRequestIds();
  }, [profileId]);

  const evaluate = useCallback(async () => {
    if (!profileId || isEvaluating.current) return;
    isEvaluating.current = true;
    try {
      const items = await getManagerNotificationFeedItems(profileId);
      const poppedIds = getPoppedRequestIds();
      const newlyArrived = selectNewlyArrivedItems(items, poppedIds);
      if (newlyArrived.length > 0) {
        // Watermark first so a failure to render (or an immediate unmount)
        // can never leave these ids re-triggerable within the same session.
        markRequestsPopped(newlyArrived.map((item) => item.id));
        setNewRequestCount(newlyArrived.length);
        setVisible(true);
      }
    } catch (err) {
      // Fail closed — never show a popup built on a failed/partial read.
      console.error('[use-manager-request-popup] evaluate failed:', err instanceof Error ? err.message : String(err));
    } finally {
      isEvaluating.current = false;
    }
  }, [profileId]);

  useEffect(() => subscribeSyncComplete(() => { void evaluate(); }), [evaluate]);

  // Cold launch / fresh login: check once against whatever is already
  // locally synced, without waiting for a background→foreground transition.
  useEffect(() => { void evaluate(); }, [evaluate]);

  // Stable references: ManagerRequestPopupBanner's auto-dismiss timer effect
  // is keyed on `onDismiss` — an inline closure here would get a new
  // identity on every render of this hook's caller (e.g. every
  // subscribeSyncComplete-triggered re-render while the banner is visible),
  // which would clear and re-arm the timer indefinitely instead of letting
  // it fire once.
  const dismiss = useCallback(() => setVisible(false), []);
  const viewRequests = useCallback(() => {
    setVisible(false);
    onViewRequests();
  }, [onViewRequests]);

  return { visible, newRequestCount, dismiss, viewRequests };
}
