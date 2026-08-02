import { describe, expect, it } from 'vitest';
import { DEFAULT_MANAGER_SCOPE, partitionByScope } from './manager-scope';

interface Row {
  agentId: string;
}

const MANAGER_ID = 'manager-1';
const rows: Row[] = [{ agentId: 'manager-1' }, { agentId: 'agent-1' }, { agentId: 'agent-2' }];

describe('DEFAULT_MANAGER_SCOPE', () => {
  it('defaults to combined, not mine or team', () => {
    expect(DEFAULT_MANAGER_SCOPE).toBe('combined');
  });
});

describe('partitionByScope', () => {
  const agentIdOf = (row: Row) => row.agentId;

  it("'mine' returns only rows owned by the manager", () => {
    expect(partitionByScope(rows, agentIdOf, MANAGER_ID, 'mine')).toEqual([{ agentId: 'manager-1' }]);
  });

  it("'team' returns every row except the manager's own", () => {
    expect(partitionByScope(rows, agentIdOf, MANAGER_ID, 'team')).toEqual([
      { agentId: 'agent-1' },
      { agentId: 'agent-2' },
    ]);
  });

  it("'combined' returns every row unchanged, manager included", () => {
    expect(partitionByScope(rows, agentIdOf, MANAGER_ID, 'combined')).toEqual(rows);
  });

  it('returns an empty array for an empty input regardless of scope', () => {
    expect(partitionByScope([], agentIdOf, MANAGER_ID, 'mine')).toEqual([]);
    expect(partitionByScope([], agentIdOf, MANAGER_ID, 'team')).toEqual([]);
    expect(partitionByScope([], agentIdOf, MANAGER_ID, 'combined')).toEqual([]);
  });

  it("'mine' and 'team' partitions are disjoint and together equal 'combined'", () => {
    const mine = partitionByScope(rows, agentIdOf, MANAGER_ID, 'mine');
    const team = partitionByScope(rows, agentIdOf, MANAGER_ID, 'team');
    expect(mine.length + team.length).toBe(rows.length);
  });
});
