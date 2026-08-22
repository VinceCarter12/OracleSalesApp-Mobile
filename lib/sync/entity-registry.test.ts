import { describe, expect, it, vi } from 'vitest';

// entity-registry.ts wires in the real `applyRemoteRow` functions from
// entity-appliers.ts, which transitively pulls in react-native's Flow-syntax
// source (via tag-along-validity-service.ts) that vitest/rolldown can't
// parse. None of that is exercised by these pure registry-shape tests, so
// stub it out — same scoping pattern as outbox-status.test.ts's
// `./entity-registry` mock.
vi.mock('./entity-appliers', () => ({
  upsertSyncedClient: vi.fn(),
  upsertSyncedClientEditRequest: vi.fn(),
  upsertSyncedClientMeetingHolder: vi.fn(),
  upsertSyncedCodRemittance: vi.fn(),
  upsertSyncedCollectionVisit: vi.fn(),
  upsertSyncedMeeting: vi.fn(),
  upsertSyncedPoConfirmationRequest: vi.fn(),
  upsertSyncedPurchaseOrder: vi.fn(),
  upsertSyncedRemittance: vi.fn(),
  upsertSyncedTagAlongRequest: vi.fn(),
}));

import {
  ENTITY_REGISTRY,
  resetLocalSyncStatusForRetry,
  tableHasSyncStatusColumn,
  type EntityTableName,
  type SyncStatusResettableDb,
} from './entity-registry';

// Regression test for the bug where `push-batch.ts::recordSynced()` ran an
// unconditional `UPDATE client_edit_requests SET sync_status = 'synced', ...`
// on every successful push — but `client_edit_requests` (ADR-052) has no
// `sync_status`/`sync_error` columns (see lib/db.ts's v20->21 migration), so
// this threw "no such column: sync_status" (surfaced by expo-sqlite as
// ERR_INTERNAL_SQLITE_ERROR) from inside the caller's fire-and-forget
// background `runSync()`. See Bugs.md for the full incident.
describe('tableHasSyncStatusColumn', () => {
  // B-127 added the second entry: `po_confirmation_requests` also carries its
  // own `status` column instead of the generic sync mirror. Omitting its
  // `hasSyncStatusColumn: false` made the push pipeline emit
  // `UPDATE ... SET sync_status = ...` against a table without that column,
  // which threw `no such column: sync_status` and killed the entire sync pass
  // — not just that row. Keep this list exact.
  //
  // ADR-067 added the third entry: `client_meeting_holders` has no local
  // write path at all (server-derived only, see entity-registry.ts's doc
  // comment on that entry), so it never had a sync_status/sync_error mirror
  // column to begin with.
  const TABLES_WITHOUT_SYNC_STATUS: EntityTableName[] = [
    'client_edit_requests',
    'po_confirmation_requests',
    'client_meeting_holders',
  ];

  it.each(TABLES_WITHOUT_SYNC_STATUS)('is false for %s (its own status column carries that meaning)', (table) => {
    expect(tableHasSyncStatusColumn(table)).toBe(false);
  });

  it('is true (default) for every other registered entity', () => {
    const otherTables = (Object.keys(ENTITY_REGISTRY) as EntityTableName[]).filter(
      (table) => !TABLES_WITHOUT_SYNC_STATUS.includes(table)
    );
    expect(otherTables.length).toBeGreaterThan(0);
    for (const table of otherTables) {
      expect(tableHasSyncStatusColumn(table)).toBe(true);
    }
  });
});

// B-104: `sync-engine.ts::retryFailedOutboxRow()` reintroduced the exact
// column-mismatch regression above by gating its own local-table UPDATE on
// `isEntityTableName()` alone instead of `tableHasSyncStatusColumn()` — this
// exercises the shared helper it was rewired to use, against a mocked db, so
// that specific call site can never silently regress again either.
describe('resetLocalSyncStatusForRetry', () => {
  function mockDb(): SyncStatusResettableDb & { runAsync: ReturnType<typeof vi.fn> } {
    return { runAsync: vi.fn().mockResolvedValue(undefined) };
  }

  it('does NOT touch the local table for client_edit_requests (no sync_status column)', async () => {
    const db = mockDb();
    await expect(resetLocalSyncStatusForRetry(db, 'client_edit_requests', 'record-1')).resolves.toBeUndefined();
    expect(db.runAsync).not.toHaveBeenCalled();
  });

  it('resets sync_status back to pending for a table that has the column', async () => {
    const db = mockDb();
    await resetLocalSyncStatusForRetry(db, 'clients', 'record-2');
    expect(db.runAsync).toHaveBeenCalledTimes(1);
    const [sql, params] = db.runAsync.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain('UPDATE clients SET sync_status');
    expect(params).toEqual(['record-2']);
  });

  it('is a no-op for an unregistered table name', async () => {
    const db = mockDb();
    await resetLocalSyncStatusForRetry(db, 'not_a_real_table', 'record-3');
    expect(db.runAsync).not.toHaveBeenCalled();
  });
});
