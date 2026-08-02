import type { TeamAgent } from '../types';

// Batch 7a (2026-08-02): extracted out of app/(manager)/team/index.tsx so the
// filter logic is independently testable. Mirrors
// Wireframe-Manager-BizLink.html's `renderTeam()` (~line 1287-1291) exactly —
// same chip values/labels and the same `rate<70` cutoff, not a newly invented
// threshold: `shown=agents.filter(a => teamFilterVal==='all' ||
// (teamFilterVal==='attention' ? a.rate<70 : a.rate>=70))`.

export type TeamFilterValue = 'all' | 'attention' | 'on_track';

export const TEAM_FILTER_OPTIONS: Array<{ value: TeamFilterValue; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'attention', label: 'Needs attention' },
  { value: 'on_track', label: 'On track' },
];

export const NEEDS_ATTENTION_RATE_CUTOFF = 70;

export function filterTeamAgents(agents: TeamAgent[], filter: TeamFilterValue): TeamAgent[] {
  if (filter === 'all') return agents;
  return agents.filter((agent) =>
    filter === 'attention'
      ? agent.successRate < NEEDS_ATTENTION_RATE_CUTOFF
      : agent.successRate >= NEEDS_ATTENTION_RATE_CUTOFF
  );
}
