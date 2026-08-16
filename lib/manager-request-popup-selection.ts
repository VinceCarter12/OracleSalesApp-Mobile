import type { ManagerNotificationFeedItem } from './manager-notification-feed-service';

/**
 * Pure selection, deliberately split out of `use-manager-request-popup.ts`
 * (which imports `react-native`'s `AppState` and can't be unit-tested in
 * this repo's Node/Vitest environment — see that file's test coverage note)
 * so the actual dedup/watermark decision is unit-testable on its own. A
 * pending client_edit/po_confirmation/tag_along item is "newly arrived" for
 * popup purposes only if it hasn't already popped up this session —
 * resolved (non-pending) items and sync/lost items are never candidates.
 *
 * 2026-08-16 (Vince direct feedback): deliberately does NOT check read
 * state. Opening/reading a request from the Notifications bell is a
 * different axis than "has the Manager acted on it" — a still-pending
 * request must keep re-popping regardless of whether it was ever read, and
 * the ONLY thing that permanently stops it is the request leaving `pending`
 * (approved/declined). See `lib/manager-request-popup-store.ts` for the
 * per-session (not permanent) popped watermark this filters against.
 */
export function selectNewlyArrivedItems(
  items: ManagerNotificationFeedItem[],
  poppedIds: ReadonlySet<string>
): ManagerNotificationFeedItem[] {
  return items.filter(
    (item) =>
      (item.category === 'approvals' || item.category === 'tag_along') &&
      item.pending &&
      !poppedIds.has(item.id)
  );
}
