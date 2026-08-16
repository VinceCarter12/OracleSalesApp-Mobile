import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ManagerApprovalFeedRow } from './manager-approval-feed-service';
import type { IncomingCompanionRequest } from './tag-along-invitee-service';
import type { PoConfirmationDisplayStatus } from './policies/po-confirmation-status-policy';

let approvalRows: ManagerApprovalFeedRow[] = [];
let tagAlongRows: IncomingCompanionRequest[] = [];
let ownPoRecords: Array<{ id: string; clientId: string; displayStatus: PoConfirmationDisplayStatus; createdAt: string; updatedAt: string; meetingId: string; poPhotoPath: string }> = [];

vi.mock('./manager-approval-feed-service', () => ({ fetchManagerApprovalFeed: () => Promise.resolve(approvalRows) }));
vi.mock('./tag-along-invitee-service', () => ({ getIncomingCompanionRequests: () => Promise.resolve(tagAlongRows) }));
vi.mock('./po-confirmation-service', () => ({ getMyPoConfirmationStatuses: () => Promise.resolve(ownPoRecords) }));
vi.mock('./client-service', () => ({ getClientById: () => Promise.resolve(null) }));

const { fetchManagerRequestFeed } = await import('./manager-request-feed-service');

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
    ...overrides,
  };
}

beforeEach(() => {
  approvalRows = [];
  tagAlongRows = [];
  ownPoRecords = [];
});

describe('fetchManagerRequestFeed — Tag-Along history correctness', () => {
  it('keeps an approved Tag-Along visible as read-only history, mapped to the approval-badge vocabulary', async () => {
    tagAlongRows = [tagAlong({ status: 'accepted' })];
    const rows = await fetchManagerRequestFeed('manager-1');
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ kind: 'tag_along', status: 'approved', requestId: 'tag-1' });
  });

  it('keeps a declined Tag-Along visible as read-only history', async () => {
    tagAlongRows = [tagAlong({ status: 'declined' })];
    const rows = await fetchManagerRequestFeed('manager-1');
    expect(rows[0]).toMatchObject({ kind: 'tag_along', status: 'rejected' });
  });

  it('still surfaces a pending Tag-Along as an actionable row', async () => {
    tagAlongRows = [tagAlong({ status: 'pending' })];
    const rows = await fetchManagerRequestFeed('manager-1');
    expect(rows[0]).toMatchObject({ kind: 'tag_along', status: 'pending' });
  });

  it('separates pending and resolved rows by status so the UI can filter them distinctly', async () => {
    tagAlongRows = [
      tagAlong({ id: 'tag-pending', status: 'pending', createdAt: '2026-08-16T02:00:00.000Z' }),
      tagAlong({ id: 'tag-resolved', status: 'accepted', createdAt: '2026-08-16T01:00:00.000Z' }),
    ];
    const rows = await fetchManagerRequestFeed('manager-1');
    const pending = rows.filter((r) => r.status === 'pending');
    const resolved = rows.filter((r) => r.status !== 'pending');
    expect(pending.map((r) => r.requestId)).toEqual(['tag-pending']);
    expect(resolved.map((r) => r.requestId)).toEqual(['tag-resolved']);
  });

  it('sorts newest first across merged client_edit/po_confirmation/tag_along rows', async () => {
    approvalRows = [
      {
        requestId: 'a-1', requestKind: 'client_edit', requesterId: 'x', requesterName: 'A', clientId: 'c', clientName: 'C',
        status: 'approved', createdAt: '2026-08-14T00:00:00.000Z', decidedAt: '2026-08-14T01:00:00.000Z',
        summary: { changes: {}, fieldCount: 0, reviewNote: null },
      } as ManagerApprovalFeedRow,
    ];
    tagAlongRows = [tagAlong({ id: 'tag-newest', createdAt: '2026-08-16T03:00:00.000Z' })];
    const rows = await fetchManagerRequestFeed('manager-1');
    expect(rows[0].requestId).toBe('tag-newest');
  });
});
