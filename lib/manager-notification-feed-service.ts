import { getOutboxCounts } from './sync-engine';
import { fetchManagerApprovalFeed } from './manager-approval-feed-service';
import { getMyCompanionRequests } from './tag-along-service';
import { buildNotificationContentId } from './notification-unread';

export type ManagerNotificationCategory = 'approvals' | 'tagalong' | 'lost' | 'sync';
export interface ManagerNotificationFeedItem {
  id: string;
  category: ManagerNotificationCategory;
  title: string;
  body: string;
  timestamp: string;
  requestId: string | null;
  syncKind: 'failed' | 'conflict' | 'pending' | null;
}

function plural(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? '' : 's'}`;
}

export async function getManagerNotificationFeedItems(profileId: string | null): Promise<ManagerNotificationFeedItem[]> {
  if (!profileId) return [];
  const [counts, approvals, tags] = await Promise.all([
    getOutboxCounts(),
    fetchManagerApprovalFeed(),
    getMyCompanionRequests(profileId),
  ]);
  const items: ManagerNotificationFeedItem[] = [];
  const loadedAt = new Date().toISOString();
  if (counts.failed > 0) items.push({ id: buildNotificationContentId(profileId, 'sync', `failed:${counts.failed}`), category: 'sync', title: `${plural(counts.failed, 'record')} failed to sync`, body: 'Needs attention — check Sync History for details.', timestamp: loadedAt, requestId: null, syncKind: 'failed' });
  if (counts.conflict > 0) items.push({ id: buildNotificationContentId(profileId, 'sync', `conflict:${counts.conflict}`), category: 'sync', title: `${plural(counts.conflict, 'sync conflict')}`, body: 'A record was changed on both the device and the server.', timestamp: loadedAt, requestId: null, syncKind: 'conflict' });
  if (counts.pending > 0) items.push({ id: buildNotificationContentId(profileId, 'sync', `pending:${counts.pending}`), category: 'sync', title: `${plural(counts.pending, 'record')} queued for sync`, body: 'Auto-uploads kapag may signal.', timestamp: loadedAt, requestId: null, syncKind: 'pending' });
  for (const row of approvals) {
    const status = row.status === 'pending' ? 'needs your decision' : `was ${row.status}`;
    items.push({ id: buildNotificationContentId(profileId, 'approvals', row.requestId), category: 'approvals', title: `${row.requestKind === 'po_confirmation' ? 'PO confirmation' : 'Client edit'} ${status}`, body: `${row.requesterName} · ${row.clientName}`, timestamp: row.decidedAt ?? row.createdAt, requestId: row.requestId, syncKind: null });
  }
  for (const row of tags) {
    items.push({ id: buildNotificationContentId(profileId, 'tagalong', row.id), category: 'tagalong', title: `Tag-Along request ${row.status}`, body: `${row.inviteeName ?? 'Teammate'} · ${row.clientName ?? 'Client unavailable'}`, timestamp: row.createdAt, requestId: row.id, syncKind: null });
  }
  return items.sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp));
}
