import { getOutboxCounts } from './sync-engine';
import { fetchManagerApprovalFeed } from './manager-approval-feed-service';
import { getIncomingCompanionRequests } from './tag-along-invitee-service';
import { buildNotificationContentId } from './notification-unread';

// 2026-08-16: added the 'tag_along' category so a newly-arrived incoming
// Sales/RSR Tag-Along request surfaces here (Wireframe-Manager-BizLink.html
// renderNotifications()'s `filters` array already lists
// `['all','All'],['approval','Approvals'],['tag','Tag-Along'],['lost','Lost'],['sync','Sync']`
// — this only wires a real data source behind the chip the wireframe already
// specifies). Deliberately reuses `getIncomingCompanionRequests()` (same read
// `lib/manager-request-feed-service.ts` and the Manager Home pending-count
// already use) rather than a new query — every row it returns is addressed
// `invitee_id = profileId`, i.e. incoming TO this manager; a manager is never
// its own `requester_id` on a normal pending-flow row (see that function's
// own doc comment), so this can never re-surface the removed Manager-owned
// companion-creation path (2026-08-12 "Manager companion-request removal").
export type ManagerNotificationCategory = 'approvals' | 'tag_along' | 'lost' | 'sync';
export interface ManagerNotificationFeedItem {
  id: string;
  category: ManagerNotificationCategory;
  title: string;
  body: string;
  timestamp: string;
  requestId: string | null;
  syncKind: 'failed' | 'conflict' | 'pending' | null;
  /** True only for an item still awaiting this manager's decision — lets the badge/popup count "needs a decision" separately from resolved history without parsing `title`. Always `false` for `sync`/`lost`. */
  pending: boolean;
}

function plural(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? '' : 's'}`;
}

export async function getManagerNotificationFeedItems(profileId: string | null): Promise<ManagerNotificationFeedItem[]> {
  if (!profileId) return [];
  const [counts, approvals, tagAlongs] = await Promise.all([
    getOutboxCounts(),
    fetchManagerApprovalFeed(),
    getIncomingCompanionRequests(profileId),
  ]);
  const items: ManagerNotificationFeedItem[] = [];
  const loadedAt = new Date().toISOString();
  if (counts.failed > 0) items.push({ id: buildNotificationContentId(profileId, 'sync', `failed:${counts.failed}`), category: 'sync', title: `${plural(counts.failed, 'record')} failed to sync`, body: 'Needs attention — check Sync History for details.', timestamp: loadedAt, requestId: null, syncKind: 'failed', pending: false });
  if (counts.conflict > 0) items.push({ id: buildNotificationContentId(profileId, 'sync', `conflict:${counts.conflict}`), category: 'sync', title: `${plural(counts.conflict, 'sync conflict')}`, body: 'A record was changed on both the device and the server.', timestamp: loadedAt, requestId: null, syncKind: 'conflict', pending: false });
  if (counts.pending > 0) items.push({ id: buildNotificationContentId(profileId, 'sync', `pending:${counts.pending}`), category: 'sync', title: `${plural(counts.pending, 'record')} queued for sync`, body: 'Auto-uploads kapag may signal.', timestamp: loadedAt, requestId: null, syncKind: 'pending', pending: false });
  for (const row of approvals) {
    const isPending = row.status === 'pending';
    const status = isPending ? 'needs your decision' : `was ${row.status}`;
    items.push({ id: buildNotificationContentId(profileId, 'approvals', row.requestId), category: 'approvals', title: `${row.requestKind === 'po_confirmation' ? 'PO confirmation' : 'Client edit'} ${status}`, body: `${row.requesterName} · ${row.clientName}`, timestamp: row.decidedAt ?? row.createdAt, requestId: row.requestId, syncKind: null, pending: isPending });
  }
  // `getIncomingCompanionRequests()` returns every status ever seen
  // (pending/accepted/declined) — only surface the still-actionable ones as
  // notification items so a decided Tag-Along doesn't duplicate as a
  // "new" notification (E: resolved history stays in Manager Requests, not
  // re-announced here).
  for (const row of tagAlongs) {
    if (row.status !== 'pending') continue;
    const requesterName = row.requesterName ?? 'Agent';
    items.push({
      id: buildNotificationContentId(profileId, 'tag_along', row.id),
      category: 'tag_along',
      title: 'Tag-Along request needs your decision',
      body: `${requesterName} · ${row.clientName ?? 'Client'}`,
      timestamp: row.createdAt,
      requestId: row.id,
      syncKind: null,
      pending: true,
    });
  }
  return items.sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp));
}

export interface ManagerNotificationDestination {
  pathname: string;
  params?: Record<string, string>;
}

/**
 * Tap destination for a Manager Notifications row — pulled out of
 * `app/(manager)/more/notifications.tsx` so it's unit-testable without
 * mounting the screen. Tag-Along no longer has its own dedicated status
 * screen (2026-08-10 merge into the combined Manager Requests inbox, see
 * `lib/manager-request-feed-service.ts`'s doc comment) — it routes into that
 * merged inbox pre-filtered via the same `kind` query param
 * `app/(manager)/approvals/index.tsx` reads on mount, not the Manager's own
 * outbound `app/(manager)/tag-along.tsx`.
 */
export function managerNotificationDestination(item: ManagerNotificationFeedItem): ManagerNotificationDestination {
  if (item.category === 'approvals') return { pathname: '/(manager)/approvals' };
  if (item.category === 'tag_along') return { pathname: '/(manager)/approvals', params: { kind: 'tag_along' } };
  if (item.category === 'sync') return { pathname: '/(manager)/more/sync-history' };
  return { pathname: '/(manager)/more/lost-opportunities/index' };
}
