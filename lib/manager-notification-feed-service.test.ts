import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ManagerApprovalFeedRow } from './manager-approval-feed-service';
import type { IncomingCompanionRequest } from './tag-along-invitee-service';

let outboxCounts = { pending: 0, syncing: 0, conflict: 0, failed: 0, synced: 0 };
let approvalRows: ManagerApprovalFeedRow[] = [];
let tagAlongRows: IncomingCompanionRequest[] = [];

vi.mock('./sync-engine', () => ({ getOutboxCounts: () => Promise.resolve(outboxCounts) }));
vi.mock('./manager-approval-feed-service', () => ({ fetchManagerApprovalFeed: () => Promise.resolve(approvalRows) }));
vi.mock('./tag-along-invitee-service', () => ({ getIncomingCompanionRequests: () => Promise.resolve(tagAlongRows) }));
vi.mock('./notification-unread', () => ({
  buildNotificationContentId: (profileId: string, category: string, title: string) => `${profileId}:${category}:${title}`,
}));

const { getManagerNotificationFeedItems, managerNotificationDestination } = await import('./manager-notification-feed-service');

function tagAlong(overrides: Partial<IncomingCompanionRequest>): IncomingCompanionRequest {
  return {
    id: 'tag-1',
    requesterId: 'agent-1',
    requesterName: 'Erika Bautista',
    inviteeKind: 'manager',
    status: 'pending',
    syncStatus: 'synced',
    createdAt: '2026-08-16T01:00:00.000Z',
    clientId: 'client-1',
    clientName: 'RMC Fuels',
    relatedMeetingId: null,
    context: 'meeting',
    ...overrides,
  };
}

beforeEach(() => {
  outboxCounts = { pending: 0, syncing: 0, conflict: 0, failed: 0, synced: 0 };
  approvalRows = [];
  tagAlongRows = [];
});

describe('getManagerNotificationFeedItems — incoming Tag-Along mapping', () => {
  it('maps a pending incoming Tag-Along request into a real, correctly-shaped item', async () => {
    tagAlongRows = [tagAlong({ id: 'tag-1', requesterName: 'Erika Bautista', clientName: 'RMC Fuels' })];
    const items = await getManagerNotificationFeedItems('manager-1');
    const tagItem = items.find((item) => item.category === 'tag_along');
    expect(tagItem).toMatchObject({
      category: 'tag_along',
      requestId: 'tag-1',
      pending: true,
      body: 'Erika Bautista · RMC Fuels',
    });
    expect(tagItem?.id).toBe('manager-1:tag_along:tag-1');
  });

  it('falls back to generic requester/client labels when null', async () => {
    tagAlongRows = [tagAlong({ requesterName: null, clientName: null })];
    const items = await getManagerNotificationFeedItems('manager-1');
    const tagItem = items.find((item) => item.category === 'tag_along');
    expect(tagItem?.body).toBe('Agent · Client');
  });

  it('excludes an already-accepted Tag-Along — resolved history does not re-announce as a new notification', async () => {
    tagAlongRows = [tagAlong({ status: 'accepted' })];
    const items = await getManagerNotificationFeedItems('manager-1');
    expect(items.some((item) => item.category === 'tag_along')).toBe(false);
  });

  it('excludes an already-declined Tag-Along', async () => {
    tagAlongRows = [tagAlong({ status: 'declined' })];
    const items = await getManagerNotificationFeedItems('manager-1');
    expect(items.some((item) => item.category === 'tag_along')).toBe(false);
  });

  it('marks approvals rows pending only when status is pending', async () => {
    approvalRows = [
      { requestId: 'a-1', requestKind: 'client_edit', requesterId: 'x', requesterName: 'A', clientId: 'c', clientName: 'C', status: 'pending', createdAt: '2026-08-16T00:00:00.000Z', decidedAt: null, summary: { changes: {}, fieldCount: 0, reviewNote: null } } as ManagerApprovalFeedRow,
      { requestId: 'a-2', requestKind: 'client_edit', requesterId: 'x', requesterName: 'A', clientId: 'c', clientName: 'C', status: 'approved', createdAt: '2026-08-15T00:00:00.000Z', decidedAt: '2026-08-15T01:00:00.000Z', summary: { changes: {}, fieldCount: 0, reviewNote: null } } as ManagerApprovalFeedRow,
    ];
    const items = await getManagerNotificationFeedItems('manager-1');
    expect(items.find((i) => i.requestId === 'a-1')?.pending).toBe(true);
    expect(items.find((i) => i.requestId === 'a-2')?.pending).toBe(false);
  });

  it('returns no items when profileId is null', async () => {
    tagAlongRows = [tagAlong({})];
    expect(await getManagerNotificationFeedItems(null)).toEqual([]);
  });
});

describe('managerNotificationDestination — tap routing', () => {
  it('routes a tag_along item into Manager Requests pre-filtered to Tag-Along, not a dedicated status screen', () => {
    const dest = managerNotificationDestination({
      id: 'x', category: 'tag_along', title: '', body: '', timestamp: '2026-08-16T00:00:00.000Z', requestId: 'tag-1', syncKind: null, pending: true,
    });
    expect(dest).toEqual({ pathname: '/(manager)/approvals', params: { kind: 'tag_along' } });
  });

  it('routes an approvals item into the unfiltered Manager Requests inbox', () => {
    const dest = managerNotificationDestination({
      id: 'x', category: 'approvals', title: '', body: '', timestamp: '2026-08-16T00:00:00.000Z', requestId: 'a-1', syncKind: null, pending: true,
    });
    expect(dest).toEqual({ pathname: '/(manager)/approvals' });
  });

  it('routes a sync item to Sync History', () => {
    const dest = managerNotificationDestination({
      id: 'x', category: 'sync', title: '', body: '', timestamp: '2026-08-16T00:00:00.000Z', requestId: null, syncKind: 'failed', pending: false,
    });
    expect(dest).toEqual({ pathname: '/(manager)/more/sync-history' });
  });

  it('routes a lost item to Lost Opportunities', () => {
    const dest = managerNotificationDestination({
      id: 'x', category: 'lost', title: '', body: '', timestamp: '2026-08-16T00:00:00.000Z', requestId: null, syncKind: null, pending: false,
    });
    expect(dest).toEqual({ pathname: '/(manager)/more/lost-opportunities/index' });
  });
});
