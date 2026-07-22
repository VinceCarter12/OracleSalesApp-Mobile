import * as SecureStore from 'expo-secure-store';
import { getDb } from './db';

// B-061: local SQLite is NOT scoped by profileId (ADR-001 assumes one device
// = one agent), so a second account signing in on a device previously used
// by a different account would otherwise see that account's stale/dead-
// lettered Sync Center records. Detects an account switch (compared against
// the last signed-in profileId, persisted the same way as
// lib/sync/last-sync.ts's getLastSyncAt/setLastSyncAt) and wipes every
// agent-owned local table before the new session proceeds. Never touches
// `PRAGMA user_version` or table schema — this is a data wipe, not a
// re-migration.

const LAST_PROFILE_ID_KEY = 'oracle_sales_last_profile_id';

// Agent-owned local tables (lib/db.ts). Read-only sync mirrors
// (`company_names_snapshot`, `team_roster_snapshot`) are wiped too, since
// they're wholesale-repopulated by the next sync-down regardless of account.
//
// NOTE: this list must be kept in sync with lib/db.ts's CREATE TABLE
// statements by hand — every new agent-scoped local table added in a future
// schema migration (LATEST_SCHEMA_VERSION bump) must be added here too, or
// this exact leak (B-061) can silently reintroduce itself for that table.
const TABLES_TO_WIPE = [
  'clients',
  'meetings',
  'meeting_drafts',
  'outbox',
  'pending_uploads',
  'tag_along_requests',
  'company_names_snapshot',
  'team_roster_snapshot',
] as const;

async function countUnsyncedOutboxRows(): Promise<number> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ count: number }>(
    "SELECT COUNT(*) as count FROM outbox WHERE status IN ('pending', 'failed')"
  );
  return row?.count ?? 0;
}

async function wipeAgentOwnedTables(): Promise<void> {
  const db = await getDb();
  for (const table of TABLES_TO_WIPE) {
    await db.runAsync(`DELETE FROM ${table}`);
  }
}

/**
 * Call once per sign-in, after the new account's `profiles.id` is known but
 * before any screen reads local data. No-ops (and does not wipe) ONLY when
 * the signing-in profileId matches the device's last signed-in profileId —
 * i.e. the same agent re-signing in. Always persists `newProfileId` as the
 * new "last signed-in" value.
 *
 * A missing `lastProfileId` (no SecureStore key yet) is deliberately treated
 * as an account-switch trigger too, NOT as "safe, nothing to leak, skip the
 * wipe" — this function shipped after the app had already been used across
 * multiple test/real accounts on some devices, so `lastProfileId === null`
 * cannot be trusted to mean "genuinely first-ever launch." Wiping is a
 * harmless no-op on tables that are already empty, so defaulting to "wipe"
 * here is safe for true first-ever installs and self-heals pre-existing
 * leaked data on devices that were already in use before this fix shipped.
 */
export async function wipeLocalDataIfAccountChanged(newProfileId: string): Promise<void> {
  const lastProfileId = await SecureStore.getItemAsync(LAST_PROFILE_ID_KEY);

  if (lastProfileId === newProfileId) {
    return;
  }

  const unsyncedCount = await countUnsyncedOutboxRows();
  if (unsyncedCount > 0) {
    // Real unsynced work from the previous account, not just dead-lettered
    // junk. Per the single-agent-per-device assumption this account switch
    // is still legitimate and the wipe proceeds — but this is worth
    // surfacing if a support issue ever comes up.
    const previousAccountDescription = lastProfileId === null
      ? 'an untracked previous session (pre-dates account-switch tracking)'
      : `previous account (${lastProfileId})`;
    console.warn(
      `[wipeLocalDataIfAccountChanged] Discarding ${unsyncedCount} unsynced outbox row(s) from ${previousAccountDescription} on account switch to ${newProfileId}.`
    );
  }

  await wipeAgentOwnedTables();
  await SecureStore.setItemAsync(LAST_PROFILE_ID_KEY, newProfileId);
}
