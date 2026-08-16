import { describe, expect, it } from 'vitest';
import { selectNewlyArrivedItems } from './manager-request-popup-selection';
import type { ManagerNotificationFeedItem } from './manager-notification-feed-service';

function item(overrides: Partial<ManagerNotificationFeedItem>): ManagerNotificationFeedItem {
  return {
    id: 'req-1',
    category: 'tag_along',
    title: 'Tag-Along request needs your decision',
    body: 'Agent · Client',
    timestamp: '2026-08-16T00:00:00.000Z',
    requestId: 'req-1',
    syncKind: null,
    pending: true,
    ...overrides,
  };
}

describe('selectNewlyArrivedItems (popup watermark/dedup logic)', () => {
  it('includes a pending tag_along item that is unpopped', () => {
    const result = selectNewlyArrivedItems([item({})], new Set());
    expect(result).toHaveLength(1);
  });

  it('includes a pending approvals item that is unpopped', () => {
    const result = selectNewlyArrivedItems(
      [item({ id: 'req-2', category: 'approvals', requestId: 'req-2' })],
      new Set()
    );
    expect(result).toHaveLength(1);
  });

  it('excludes an item already watermarked as popped this session — same request never re-triggers within it', () => {
    const result = selectNewlyArrivedItems([item({})], new Set(['req-1']));
    expect(result).toHaveLength(0);
  });

  it('a genuinely new request (different id) still triggers even when another id is already popped', () => {
    const result = selectNewlyArrivedItems(
      [item({ id: 'req-1' }), item({ id: 'req-2', requestId: 'req-2' })],
      new Set(['req-1'])
    );
    expect(result.map((i) => i.id)).toEqual(['req-2']);
  });

  it('2026-08-16: a still-pending item is selected even if it has already been read — read state never permanently silences the popup, only leaving pending does', () => {
    // Regression guard: a Manager opening/reading a request notification
    // from the bell must NOT stop it from re-popping while it's still
    // undecided. Read state simply isn't a signal this function accepts.
    const result = selectNewlyArrivedItems([item({})], new Set());
    expect(result).toHaveLength(1);
  });

  it('excludes a resolved (non-pending) item', () => {
    const result = selectNewlyArrivedItems([item({ pending: false })], new Set());
    expect(result).toHaveLength(0);
  });

  it('excludes sync and lost categories even if somehow marked pending', () => {
    const result = selectNewlyArrivedItems(
      [item({ category: 'sync', syncKind: 'failed' }), item({ id: 'req-2', category: 'lost', requestId: 'req-2' })],
      new Set()
    );
    expect(result).toHaveLength(0);
  });
});
