import { describe, expect, it } from 'vitest';
import {
  isBulkApprovable,
  isLockedBySelection,
  resolveBulkSelection,
  type BulkSelectableRequest,
} from './bulk-approval-selection';

function row(overrides: Partial<BulkSelectableRequest> & { requestId: string }): BulkSelectableRequest {
  return {
    kind: 'client_edit',
    status: 'pending',
    requesterId: 'agent-a',
    requesterName: 'Marisa Cruz',
    ...overrides,
  };
}

describe('isBulkApprovable', () => {
  it('accepts a pending client edit', () => {
    expect(isBulkApprovable(row({ requestId: 'r1' }))).toBe(true);
  });

  it('rejects PO confirmations — the photo has to be opened', () => {
    expect(isBulkApprovable(row({ requestId: 'r1', kind: 'po_confirmation' }))).toBe(false);
  });

  it('rejects tag-alongs — a different write path entirely', () => {
    expect(isBulkApprovable(row({ requestId: 'r1', kind: 'tag_along', requesterId: null }))).toBe(false);
  });

  it('rejects anything already decided', () => {
    expect(isBulkApprovable(row({ requestId: 'r1', status: 'approved' }))).toBe(false);
    expect(isBulkApprovable(row({ requestId: 'r1', status: 'rejected' }))).toBe(false);
  });

  it('rejects a row with no known requester, since a batch is defined by its agent', () => {
    expect(isBulkApprovable(row({ requestId: 'r1', requesterId: null }))).toBe(false);
  });
});

describe('resolveBulkSelection', () => {
  const rows = [
    row({ requestId: 'a1' }),
    row({ requestId: 'a2' }),
    row({ requestId: 'b1', requesterId: 'agent-b', requesterName: 'Ramon Diaz' }),
    row({ requestId: 'po1', kind: 'po_confirmation' }),
    row({ requestId: 'done', status: 'approved' }),
  ];

  it('is empty when nothing is ticked', () => {
    expect(resolveBulkSelection(rows, [])).toEqual({
      selectedIds: [],
      requesterId: null,
      requesterName: null,
      eligibleIds: [],
    });
  });

  it('names the owning agent and lists every eligible request of theirs', () => {
    const selection = resolveBulkSelection(rows, ['a1']);
    expect(selection.requesterId).toBe('agent-a');
    expect(selection.requesterName).toBe('Marisa Cruz');
    // 'po1' and 'done' share the requester but are not approvable.
    expect(selection.eligibleIds).toEqual(['a1', 'a2']);
  });

  it('drops ticks for rows no longer on screen, e.g. after a filter narrows', () => {
    const selection = resolveBulkSelection([rows[0]], ['a1', 'a2']);
    expect(selection.selectedIds).toEqual(['a1']);
    expect(selection.eligibleIds).toEqual(['a1']);
  });

  it('drops a tick for a row decided out from under the inbox', () => {
    const decided = [row({ requestId: 'a1', status: 'approved' }), rows[1]];
    // Only 'a1' was ticked and it is no longer pending, so the batch empties —
    // 'a2' is eligible but was never tapped.
    expect(resolveBulkSelection(decided, ['a1']).selectedIds).toEqual([]);
    expect(resolveBulkSelection(decided, ['a1', 'a2']).selectedIds).toEqual(['a2']);
  });

  it('never mixes two agents — a stale tick from another agent is discarded', () => {
    const selection = resolveBulkSelection(rows, ['a1', 'b1', 'a2']);
    expect(selection.requesterId).toBe('agent-a');
    expect(selection.selectedIds).toEqual(['a1', 'a2']);
  });

  it('takes the owning agent from the first SURVIVING tick, not the first tapped one', () => {
    // 'a1' was ticked first but has since been decided, so the batch belongs
    // to agent-b — not to a row that is no longer there.
    const withDecided = [row({ requestId: 'a1', status: 'approved' }), rows[2]];
    const selection = resolveBulkSelection(withDecided, ['a1', 'b1']);
    expect(selection.requesterId).toBe('agent-b');
    expect(selection.selectedIds).toEqual(['b1']);
  });

  it('reports every eligible id across the whole filtered set, not just what is ticked', () => {
    expect(resolveBulkSelection(rows, ['a2']).eligibleIds).toEqual(['a1', 'a2']);
  });
});

describe('isLockedBySelection', () => {
  const rows = [row({ requestId: 'a1' }), row({ requestId: 'b1', requesterId: 'agent-b' })];

  it('locks nothing while the selection is empty', () => {
    const empty = resolveBulkSelection(rows, []);
    expect(isLockedBySelection(rows[0], empty)).toBe(false);
    expect(isLockedBySelection(rows[1], empty)).toBe(false);
  });

  it("locks another agent's approvable rows once a batch is open", () => {
    const selection = resolveBulkSelection(rows, ['a1']);
    expect(isLockedBySelection(rows[1], selection)).toBe(true);
  });

  it('leaves the owning agent’s own rows unlocked', () => {
    const selection = resolveBulkSelection(rows, ['a1']);
    expect(isLockedBySelection(rows[0], selection)).toBe(false);
  });

  it('does not lock rows that were never selectable — they offered no tick to begin with', () => {
    const selection = resolveBulkSelection(rows, ['a1']);
    const po = row({ requestId: 'po1', kind: 'po_confirmation', requesterId: 'agent-b' });
    const tagAlong = row({ requestId: 't1', kind: 'tag_along', requesterId: null });
    expect(isLockedBySelection(po, selection)).toBe(false);
    expect(isLockedBySelection(tagAlong, selection)).toBe(false);
  });
});
