import type { SyncHistoryEntry } from './sync-history';
import type { BizFilterOption } from '../components/bizlink/BizFilterScroll';

/**
 * Every value `getDisplayStatus()` can return. A superset of the wireframe's
 * four filter chips (`all/synced/resolved/retried`, `aRenderSyncHistory()` /
 * `renderSyncHistory()`) because a `conflict`/`failed` row with zero retries
 * has no matching chip yet and falls through to its raw outbox status.
 */
export type SyncHistoryDisplayStatus = 'synced' | 'resolved' | 'retried' | 'conflict' | 'failed';

/**
 * The values the wireframe's filter chips actually offer
 * (`Wireframe-Sales-BizLink.html` `aRenderSyncHistory()` and
 * `Wireframe-Manager-BizLink.html` `renderSyncHistory()` both build
 * `[['all','All'],['synced','Synced'],['resolved','Resolved'],['retried','Retried']]`)
 * — narrower than `SyncHistoryDisplayStatus`/`SyncHistoryOutcome`, which is
 * why `OUTCOME_FILTERS` was previously (incorrectly) typed against
 * `SyncHistoryOutcome` and failed `tsc --noEmit` for `'resolved'`/`'retried'`.
 */
export type SyncHistoryFilterValue = 'all' | 'synced' | 'resolved' | 'retried';

export const SYNC_HISTORY_OUTCOME_FILTERS: BizFilterOption<SyncHistoryFilterValue>[] = [
  { value: 'all', label: 'All' },
  { value: 'synced', label: 'Uploaded' },
  { value: 'resolved', label: 'Fixed' },
  { value: 'retried', label: 'Retrying' },
];

/** Maps an outbox row's terminal status to the wireframe's display vocabulary. */
export function getDisplayStatus(entry: SyncHistoryEntry): SyncHistoryDisplayStatus {
  if (entry.status === 'synced') return 'synced';
  if (entry.status === 'conflict' && entry.retryCount > 0) return 'resolved';
  if (entry.status === 'failed' && entry.retryCount > 0) return 'retried';
  return entry.status;
}

/**
 * Every table the app actually writes through the offline outbox (grepped
 * across `lib/*-service.ts`/`lib/*-write.ts`, not just the wireframe's demo
 * data which only ever shows `clients`/`meetings`) — used wherever a Sync
 * History row needs a human label instead of the raw snake_case table name.
 */
export const SYNC_TABLE_LABEL: Record<string, string> = {
  clients: 'Client',
  meetings: 'Meeting',
  client_edit_requests: 'Client edit request',
  collection_visits: 'Collection visit',
  purchase_orders: 'Purchase order',
  remittances: 'Remittance',
  cod_remittances: 'COD remittance',
  tag_along_requests: 'Tag-along request',
  pending_uploads: 'Photo upload',
};

/** Wireframe's per-row/per-detail "note" text (`h.note` in the mock data, both wireframes). */
export function getResultMessage(entry: SyncHistoryEntry): string {
  if (entry.status === 'synced') return 'Uploaded from this phone';
  if (entry.status === 'conflict') return 'Conflict fixed: renamed';
  if (entry.status === 'failed' && entry.retryCount > 0) {
    return `It failed first, then was uploaded on the ${entry.retryCount === 1 ? '2nd' : entry.retryCount + 1}nd try`;
  }
  return 'Processing';
}
