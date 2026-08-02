import { describe, expect, it } from 'vitest';
import { filterTeamAgents } from './team-attention-filter';
import type { TeamAgent } from '../types';

function agent(overrides: Partial<TeamAgent>): TeamAgent {
  return {
    id: 'a1',
    name: 'Agent',
    initials: 'A',
    meetingsThisMonth: 0,
    activeClients: 0,
    successRate: 0,
    ...overrides,
  } as TeamAgent;
}

describe('filterTeamAgents', () => {
  const agents = [agent({ id: '1', successRate: 69 }), agent({ id: '2', successRate: 70 }), agent({ id: '3', successRate: 100 })];

  it('"all" returns every agent unfiltered', () => {
    expect(filterTeamAgents(agents, 'all')).toHaveLength(3);
  });

  it('"attention" matches the wireframe cutoff rate<70 (exclusive)', () => {
    const shown = filterTeamAgents(agents, 'attention');
    expect(shown.map((a) => a.id)).toEqual(['1']);
  });

  it('"on_track" matches rate>=70 (inclusive)', () => {
    const shown = filterTeamAgents(agents, 'on_track');
    expect(shown.map((a) => a.id)).toEqual(['2', '3']);
  });
});
