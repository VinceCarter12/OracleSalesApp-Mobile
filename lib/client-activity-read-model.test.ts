import { describe, expect, it, vi } from 'vitest';
import { getActiveDraftsForAgent } from './meeting-drafts';
vi.mock('./db', () => ({ getDb: vi.fn() }));
vi.mock('./meeting-drafts', () => ({ getActiveDraftsForAgent: vi.fn() }));
vi.mock('./sync/sync-events', () => ({ subscribeSyncComplete: vi.fn(() => () => {}) }));
vi.mock('./app-db-provider', () => ({ useAppDb: vi.fn() }));
vi.mock('./session-store', () => ({ useSession: vi.fn(() => ({ profileId: null })) }));
import { readClientActivityModels, selectCyclePoState, selectPoState, selectTagAlongState } from './client-activity-read-model';

describe('client activity status selectors', () => {
  it('distinguishes queued tag-along from server-pending', () => {
    expect(selectTagAlongState([{ status: 'pending', sync_status: 'pending' }])).toBe('queued');
    expect(selectTagAlongState([{ status: 'pending', sync_status: 'synced' }])).toBe('pending');
  });

  it('does not call failed/conflicted Tag-Along work queued', () => {
    expect(selectTagAlongState([{ status: 'pending', sync_status: 'failed' }])).toBe('failed');
    expect(selectTagAlongState([{ status: 'pending', sync_status: 'conflict' }])).toBe('failed');
  });

  it('keeps terminal tag-along history truthful', () => {
    expect(selectTagAlongState([{ status: 'declined', sync_status: 'synced' }])).toBe('declined');
  });

  it.each([
    ['draft', null, 'draft'],
    ['pending', null, 'queued'],
    ['pending', '2026-08-14T01:00:00Z', 'pending'],
    ['approved', '2026-08-14T01:00:00Z', 'approved'],
  ] as const)('maps PO %s (%s) to %s', (status, syncedAt, expected) => {
    expect(selectPoState([{ status, synced_at: syncedAt }])).toBe(expected);
  });

  it('allows rejected or cancelled PO replacement while preserving terminal history', () => {
    expect(selectPoState([{ status: 'rejected', synced_at: 'x' }])).toBe('rejected');
    expect(selectPoState([{ status: 'cancelled', synced_at: 'x' }])).toBe('cancelled');
  });

  it('keeps losing offline evidence visibly duplicate-blocked', () => {
    expect(selectPoState([{ status: 'duplicate_blocked', synced_at: null }])).toBe('duplicate_blocked');
  });

  it('does not let newer terminal or blocked history mask an older active reservation', () => {
    expect(selectPoState([
      { status: 'rejected', synced_at: 'newer' },
      { status: 'approved', synced_at: 'older' },
    ])).toBe('approved');
    expect(selectPoState([
      { status: 'duplicate_blocked', synced_at: null },
      { status: 'pending', synced_at: 'older' },
    ])).toBe('pending');
  });

  it('keeps an older active reservation authoritative over newer terminal history', () => {
    expect(selectPoState([
      { status: 'rejected', synced_at: 'newer' },
      { status: 'approved', synced_at: 'older' },
    ])).toBe('approved');
  });

  it('scopes PO status to the current cycle and fails closed when cycle is missing', () => {
    expect(selectCyclePoState([{ cycle_id: 'old', status: 'approved', synced_at: 'x' }], 'current')).toBe('none');
    expect(selectCyclePoState([{ cycle_id: 'current', status: 'approved', synced_at: 'x' }], null)).toBe('none');
  });

  it('keeps a rejected current-cycle PO replaceable without leaking an older cycle reservation', () => {
    expect(selectCyclePoState([
      { cycle_id: 'current', status: 'rejected', synced_at: 'newer' },
      { cycle_id: 'old', status: 'approved', synced_at: 'older' },
    ], 'current')).toBe('rejected');
    expect(selectCyclePoState([
      { cycle_id: 'current', status: 'rejected', synced_at: 'newer' },
      { cycle_id: 'current', status: 'approved', synced_at: 'older' },
    ], 'current')).toBe('approved');
  });

  it('assembles multiple lifecycle clients from batched local rows', async () => {
    vi.mocked(getActiveDraftsForAgent).mockResolvedValue([]);
    const getAllAsync = vi.fn()
      .mockResolvedValueOnce([{ client_id: 'c1', meeting_count: 2, latest_meeting_at: '2026-08-14T01:00:00Z' }])
      .mockResolvedValueOnce([{ related_client_id: 'c1', status: 'pending', sync_status: 'pending' }])
      .mockResolvedValueOnce([{ client_id: 'c1', cycle_id: 'cycle-1', status: 'approved', synced_at: 'x' }]);
    const rows = await readClientActivityModels([
      { id: 'c1', status: 'in_progress', cycle_id: 'cycle-1' },
      { id: 'c2', status: 'new', cycle_id: null },
      { id: 'c3', status: 'prospect', cycle_id: null },
    ], 'agent-1', { getAllAsync });
    expect(rows).toEqual([
      expect.objectContaining({ clientId: 'c1', meetingCount: 2, tagAlong: 'queued', po: 'approved' }),
      expect.objectContaining({ clientId: 'c2', meetingCount: 0, cycleDataStale: true, po: 'none' }),
      expect.objectContaining({ clientId: 'c3', meetingCount: 0, cycleDataStale: false }),
    ]);
    expect(getAllAsync).toHaveBeenCalledTimes(3);
  });
});
