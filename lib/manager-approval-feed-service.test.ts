import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ManagerApprovalFeedItem } from './po-confirmation-manager-service';

let feedItems: ManagerApprovalFeedItem[] = [];
const getManagerApprovalFeed = vi.fn(() => Promise.resolve(feedItems));

vi.mock('./po-confirmation-manager-service', () => ({
  getManagerApprovalFeed: () => getManagerApprovalFeed(),
}));

vi.mock('./policies/po-confirmation-status-policy', () => ({
  PO_CONFIRMATION_REQUEST_KIND: 'po_confirmation',
}));

interface NameQueryResult {
  data: Array<Record<string, string>> | null;
  error: { message: string } | null;
}
let profileNamesResult: NameQueryResult;
let clientNamesResult: NameQueryResult;

const inMock = vi.fn((_column: string, _ids: string[]) => {
  // Distinguish by which select() call preceded this — tracked via a module-level flag below.
  return currentTable === 'profiles' ? Promise.resolve(profileNamesResult) : Promise.resolve(clientNamesResult);
});
let currentTable: 'profiles' | 'clients' = 'profiles';
const selectMock = vi.fn(() => ({ in: inMock }));
const fromMock = vi.fn((table: 'profiles' | 'clients') => {
  currentTable = table;
  return { select: selectMock };
});

vi.mock('./supabase', () => ({
  supabase: { from: (table: 'profiles' | 'clients') => fromMock(table) },
}));

const { fetchManagerApprovalFeed } = await import('./manager-approval-feed-service');

function item(overrides: Partial<ManagerApprovalFeedItem>): ManagerApprovalFeedItem {
  return {
    requestKind: 'client_edit',
    requestId: 'req-1',
    requesterId: 'agent-1',
    clientId: 'client-1',
    status: 'pending',
    createdAt: '2026-08-01T00:00:00.000Z',
    decidedAt: null,
    summary: {},
    ...overrides,
  };
}

beforeEach(() => {
  getManagerApprovalFeed.mockClear();
  fromMock.mockClear();
  selectMock.mockClear();
  inMock.mockClear();
  profileNamesResult = { data: [{ id: 'agent-1', full_name: 'Ana Reyes' }], error: null };
  clientNamesResult = { data: [{ id: 'client-1', company_name: 'RMC Fuels' }], error: null };
});

describe('fetchManagerApprovalFeed', () => {
  it('shapes a client_edit row with camelCase summary fields', async () => {
    feedItems = [
      item({
        summary: {
          changes: { sales_channel: { old: 'Distributor', new: 'Dealer' } },
          field_count: 1,
          review_note: 'Confirmed with client',
        },
      }),
    ];

    const rows = await fetchManagerApprovalFeed();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      requestKind: 'client_edit',
      requesterName: 'Ana Reyes',
      clientName: 'RMC Fuels',
      summary: {
        changes: { sales_channel: { old: 'Distributor', new: 'Dealer' } },
        fieldCount: 1,
        reviewNote: 'Confirmed with client',
      },
    });
  });

  it('shapes a po_confirmation row with camelCase summary fields', async () => {
    feedItems = [
      item({
        requestKind: 'po_confirmation',
        summary: { po_photo_path: 'po/photo.jpg', meeting_id: 'meeting-9' },
      }),
    ];

    const rows = await fetchManagerApprovalFeed();
    expect(rows[0]).toMatchObject({
      requestKind: 'po_confirmation',
      summary: { poPhotoPath: 'po/photo.jpg', meetingId: 'meeting-9' },
    });
  });

  it('excludes tag_along rows — that kind keeps its own dedicated flow', async () => {
    feedItems = [item({ requestKind: 'tag_along', summary: { invitee_kind: 'manager' } })];
    const rows = await fetchManagerApprovalFeed();
    expect(rows).toHaveLength(0);
  });

  it('excludes rows with a status outside pending/approved/rejected (e.g. cancelled)', async () => {
    feedItems = [item({ status: 'cancelled' })];
    const rows = await fetchManagerApprovalFeed();
    expect(rows).toHaveLength(0);
  });

  it('falls back to a generic name when a requester/client name lookup misses', async () => {
    profileNamesResult = { data: [], error: null };
    clientNamesResult = { data: [], error: null };
    feedItems = [item({ summary: { changes: {}, field_count: 0, review_note: null } })];

    const rows = await fetchManagerApprovalFeed();
    expect(rows[0].requesterName).toBe('Agent');
    expect(rows[0].clientName).toBe('Client');
  });
});
