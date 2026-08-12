import { getOutboxCounts } from './sync-engine';
import { getRecentCompanionTagsForInvitee } from './tag-along-invitee-service';
import { getMyPoConfirmationStatuses } from './po-confirmation-service';
import { getClientById } from './client-service';
import { PO_CONFIRMATION_STATUS_LABELS, type PoConfirmationDisplayStatus } from './policies/po-confirmation-status-policy';
import { buildNotificationContentId } from './notification-unread';

// Notifications-Page-Handoff-2026-08-08: pure data assembly, split out of
// `app/(tabs)/more/notifications.tsx` so the same feed (and its stable
// content ids) can also power the Home dashboard bell dot and the More-tile
// badge (`lib/use-unread-notification-count.ts`) without those two call
// sites re-deriving item construction themselves — same "services own
// data, screens own JSX/icons" split this codebase already follows
// elsewhere (e.g. `lib/tag-along-service.ts` vs. its screens).
//
// Every source here is SQLite-backed and offline-capable, matching the
// original screen's scope note: `getOutboxCounts()` (same source as the
// Home sync chip), this agent's own recent manager tag-alongs
// (`getRecentCompanionTagsForInvitee`), and this agent's own PO
// confirmation statuses (`getMyPoConfirmationStatuses`). No direct Supabase
// calls are made from this module.

export type NotificationCategory = 'sync' | 'tagalong' | 'po';

/**
 * Filter-taxonomy decision (handoff Task 2): the wireframe's `aNotificationCategory()`
 * (`Wireframe-Sales-BizLink.html` ~line 1232) is
 * `n.category || (n.companionRequestId || n.icon==='hourglass' ? 'action' : 'update')`
 * — an item is "action needed" only if it has an explicit actionable hook
 * (a pending companion request, or a deadline-style urgency icon) or an
 * explicit `category:'action'` override; everything else is "update". This
 * screen has neither companion-request Accept/Decline (Manager-side per
 * ADR-030 Pass 3) nor deadline reminders (T-018, unimplemented), so the
 * real equivalent judgment call, scoped to what this screen actually shows:
 * - sync `failed`/`conflict` -> needs the agent to look at Sync History and
 *   act (retry/resolve) -> 'action'.
 * - sync `pending` (queued, auto-uploads) -> purely informational -> 'update'.
 * - a manager tag-along tag shown here is already `status='accepted'`
 *   (F-205/B-053 pre-accepted path) — nothing left for the agent to decide
 *   -> 'update'.
 * - PO evidence `submission_required` (captured but not yet submitted,
 *   waiting on connectivity) -> 'action'; every other PO status
 *   (`pending`/`approved`/`rejected`/`cancelled`/`superseded`) is a decision
 *   already made or waiting on the Manager, not the agent -> 'update'.
 */
export type NotificationKind = 'action' | 'update';

export interface NotificationFeedItem {
  /** Stable content id (`buildNotificationContentId`) — also this list's React key and the read-state lookup key. */
  id: string;
  category: NotificationCategory;
  kind: NotificationKind;
  title: string;
  body: string;
  /** ISO 8601. Sync items have no real per-event timestamp (they're a live aggregate re-derived every load, not a stored entity) — captured at load time, see the call site's comment. */
  timestamp: string;
  /** Present when the item should navigate to a client's own Client Detail on tap. */
  clientId: string | null;
  /** Present when the item should navigate to a specific meeting's Meeting Detail on tap (PO evidence items). */
  meetingId: string | null;
  /** Discriminates which sync icon/tone to render — only set for `category === 'sync'`. */
  syncKind: 'failed' | 'conflict' | 'pending' | null;
  /** Only set for `category === 'po'` — drives icon tone via `PO_CONFIRMATION_BADGE_TONES`. */
  poDisplayStatus: PoConfirmationDisplayStatus | null;
}

function pluralRecords(count: number): string {
  return `${count} record${count === 1 ? '' : 's'}`;
}

export async function getNotificationFeedItems(profileId: string | null): Promise<NotificationFeedItem[]> {
  const items: NotificationFeedItem[] = [];
  if (!profileId) return items;

  const [counts, managerTags, poConfirmations] = await Promise.all([
    getOutboxCounts(),
    getRecentCompanionTagsForInvitee(profileId),
    getMyPoConfirmationStatuses(profileId),
  ]);

  // Sync-outbox items have no individual event timestamp (an aggregate
  // count, not a stored row) — "now" (load time) is the honest value: it's
  // the current status as of this read, not a historical event.
  const loadedAt = new Date().toISOString();

  if (counts.failed > 0) {
    const title = `${pluralRecords(counts.failed)} couldn't be uploaded`;
    items.push({
      id: buildNotificationContentId(profileId, 'sync', title),
      category: 'sync',
      kind: 'action',
      title,
      body: 'Needs your attention — open Uploads to see which one.',
      timestamp: loadedAt,
      clientId: null,
      meetingId: null,
      syncKind: 'failed',
      poDisplayStatus: null,
    });
  }
  if (counts.conflict > 0) {
    const title = `${counts.conflict} sync conflict${counts.conflict === 1 ? '' : 's'}`;
    items.push({
      id: buildNotificationContentId(profileId, 'sync', title),
      category: 'sync',
      kind: 'action',
      title,
      body: 'This item was changed on your phone at the same time it was changed in the system. The app needs you to choose which version to keep.',
      timestamp: loadedAt,
      clientId: null,
      meetingId: null,
      syncKind: 'conflict',
      poDisplayStatus: null,
    });
  }
  if (counts.pending > 0) {
    const title = `${pluralRecords(counts.pending)} waiting to upload`;
    items.push({
      id: buildNotificationContentId(profileId, 'sync', title),
      category: 'sync',
      kind: 'update',
      title,
      body: 'These will be sent automatically once you\'re online.',
      timestamp: loadedAt,
      clientId: null,
      meetingId: null,
      syncKind: 'pending',
      poDisplayStatus: null,
    });
  }

  for (const tag of managerTags) {
    const managerName = tag.requesterName ?? 'Your manager';
    const title = `${managerName} invited you to a meeting`;
    items.push({
      id: buildNotificationContentId(profileId, 'tagalong', `${title}:${tag.id}`),
      category: 'tagalong',
      kind: 'update',
      title,
      body: tag.clientName ?? 'Client name unavailable.',
      timestamp: tag.createdAt,
      clientId: tag.clientId,
      meetingId: null,
      syncKind: null,
      poDisplayStatus: null,
    });
  }

  const poWithClientNames = await Promise.all(
    poConfirmations.map(async (record) => ({
      record,
      clientName: (await getClientById(record.clientId))?.company_name ?? null,
    }))
  );
  for (const { record, clientName } of poWithClientNames) {
    const title = clientName ? `PO evidence — ${clientName}` : 'PO evidence update';
    items.push({
      id: buildNotificationContentId(profileId, 'po', `${title}:${record.id}`),
      category: 'po',
      kind: record.displayStatus === 'submission_required' ? 'action' : 'update',
      title,
      body: PO_CONFIRMATION_STATUS_LABELS[record.displayStatus],
      timestamp: record.updatedAt,
      clientId: record.clientId,
      meetingId: record.meetingId,
      syncKind: null,
      poDisplayStatus: record.displayStatus,
    });
  }

  return items;
}
