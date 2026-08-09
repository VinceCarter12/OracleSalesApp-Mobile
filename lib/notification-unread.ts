import * as SecureStore from 'expo-secure-store';

// Notifications-Page-Handoff-2026-08-08, Task 1: a local-only, offline-first
// read/unread store for the Notifications screen — mirrors
// `lib/feature-flags.ts`'s SecureStore persistence pattern (the codebase's
// existing convention for small device-local key-value state), not a new
// mechanism. Deliberately has NO server-side counterpart: per Context.md's
// sync-engine notes, ADR-001/002/004 govern what SYNCS to Supabase, but
// read-state here is presentation-only bookkeeping the agent's own device
// keeps for itself — never enqueued to the outbox, never uploaded.
//
// Notifications don't have a durable row id of their own (sync-count items
// in particular are a live aggregate re-derived every load, not a stored
// entity) — per the handoff's decision, the "content id" is
// `${profileId}:${category}:${title}` (see `buildNotificationContentId`),
// stable as long as the title text is unchanged. A title that changes (e.g.
// "3 records failed to sync" -> "1 record failed to sync") is treated as a
// genuinely new notification and reverts to unread — an accepted tradeoff
// for not having real per-notification identity.

const READ_IDS_KEY = 'oracle_notification_read_ids_v1';

// Android's SecureStore-backed encrypted SharedPreferences value has a
// practical per-key size ceiling (~2KB) — bounding the tracked-id list
// keeps this well under that regardless of how long the app has been used.
// Oldest reads are evicted first (simple FIFO, not true LRU) since re-reading
// an old notification is rare and losing its read state just means it shows
// unread again, never a crash or data loss.
const MAX_TRACKED_READ_IDS = 200;

async function loadReadIds(): Promise<string[]> {
  try {
    const raw = await SecureStore.getItemAsync(READ_IDS_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((value): value is string => typeof value === 'string') : [];
  } catch {
    return [];
  }
}

async function saveReadIds(ids: string[]): Promise<void> {
  try {
    await SecureStore.setItemAsync(READ_IDS_KEY, JSON.stringify(ids.slice(-MAX_TRACKED_READ_IDS)));
  } catch (err) {
    console.error('[notification-unread] failed to persist read state:', err instanceof Error ? err.message : String(err));
  }
}

/** Stable content id for a notification card — see the file-level doc comment for the tradeoff this implies. */
export function buildNotificationContentId(profileId: string, category: string, title: string): string {
  return `${profileId}:${category}:${title}`;
}

/** Fails open to "nothing read" on any storage error, so a read-state bug never blocks the feed itself from rendering. */
export async function getReadNotificationIds(): Promise<Set<string>> {
  return new Set(await loadReadIds());
}

export async function markNotificationRead(id: string): Promise<void> {
  const ids = await loadReadIds();
  if (ids.includes(id)) return;
  ids.push(id);
  await saveReadIds(ids);
}
