import type { OutboxCounts } from './sync-engine';

export function getUnsyncedWorkCount(counts: OutboxCounts): number {
  return counts.pending + counts.syncing + counts.conflict + counts.failed;
}

export function describeUnsyncedWork(counts: OutboxCounts): string {
  const parts = [
    counts.pending > 0 ? `${counts.pending} pending` : null,
    counts.syncing > 0 ? `${counts.syncing} syncing` : null,
    counts.conflict > 0 ? `${counts.conflict} needs review` : null,
    counts.failed > 0 ? `${counts.failed} failed` : null,
  ].filter((part): part is string => part !== null);
  return parts.join(', ');
}
