import * as SecureStore from 'expo-secure-store';

// ADR-026 P2 item 6: tracks when the last sync pass completed far enough to
// be meaningful (past the isSyncing/offline early-returns in
// sync-engine.ts::runSync()). Same get/set-via-SecureStore shape as
// lib/sync/audit-log.ts::getDeviceId(), but get/set rather than
// get-or-generate-once — this value legitimately changes on every sync pass.

const LAST_SYNC_AT_KEY = 'oracle_sales_last_sync_at';

export async function getLastSyncAt(): Promise<string | null> {
  return SecureStore.getItemAsync(LAST_SYNC_AT_KEY);
}

export async function setLastSyncAt(iso: string): Promise<void> {
  await SecureStore.setItemAsync(LAST_SYNC_AT_KEY, iso);
}
