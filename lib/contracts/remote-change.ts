// Batch 1 (ADR-036/ADR-037) scaffolding — types only, no live consumer yet.

export type RemoteChangeSource = 'poll' | 'push' | 'manual_refresh';

export interface RemoteChangeSignal {
  tableName: string;
  recordId: string | null;
  changedAt: string;
  source: RemoteChangeSource;
}
