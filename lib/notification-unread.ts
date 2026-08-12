import * as SecureStore from 'expo-secure-store';

const READ_IDS_KEY = 'oracle_notification_read_ids_v1';
const PRESENTATION_KEY = 'oracle_notification_presentation_v1';
const READ_AT_META_KEY = 'oracle_notification_read_at_meta_v1';
const READ_AT_CHUNK_PREFIX = 'oracle_notification_read_at_v1_';
const ARCHIVED_META_KEY = 'oracle_notification_archived_meta_v1';
const ARCHIVED_CHUNK_PREFIX = 'oracle_notification_archived_v1_';
const CLEARED_META_KEY = 'oracle_notification_cleared_meta_v1';
const CLEARED_CHUNK_PREFIX = 'oracle_notification_cleared_v1_';
const RETENTION_MS = 7 * 24 * 60 * 60 * 1000;
// SecureStore values are deliberately kept small.  Do not cap the number of
// viewed notifications: every item must remain read for the full retention
// window.  Chunking keeps the aggregate state safe for Android SecureStore.
const READ_AT_CHUNK_CHARS = 1200;
const EMPTY = { readAt: {} as Record<string, string>, archived: [] as string[], cleared: [] as string[] };
export interface NotificationPresentationState { readAt: Record<string, string>; archived: string[]; cleared: string[] }

async function legacyIds(): Promise<string[]> { try { const raw = await SecureStore.getItemAsync(READ_IDS_KEY); const value: unknown = raw ? JSON.parse(raw) : []; return Array.isArray(value) ? value.filter((id): id is string => typeof id === 'string') : []; } catch { return []; } }
async function loadReadAt(): Promise<Record<string, string>> {
  const readAt: Record<string, string> = {};
  const metaRaw = await SecureStore.getItemAsync(READ_AT_META_KEY);
  const count = metaRaw ? Number.parseInt(metaRaw, 10) : 0;
  if (Number.isFinite(count) && count > 0) {
    for (let index = 0; index < count; index += 1) {
      const raw = await SecureStore.getItemAsync(`${READ_AT_CHUNK_PREFIX}${index}`);
      if (!raw) continue;
      try {
        const value: unknown = JSON.parse(raw);
        if (value && typeof value === 'object' && !Array.isArray(value)) {
          for (const [id, ts] of Object.entries(value)) if (typeof ts === 'string') readAt[id] = ts;
        }
      } catch { /* ignore a corrupt chunk; other chunks remain usable */ }
    }
    return readAt;
  }
  // Migrate the previous single-value shape on the next save.
  try {
    const raw = await SecureStore.getItemAsync(PRESENTATION_KEY);
    if (!raw) return readAt;
    const value: unknown = JSON.parse(raw);
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      const legacy = (value as Partial<NotificationPresentationState>).readAt;
      if (legacy && typeof legacy === 'object') for (const [id, ts] of Object.entries(legacy)) if (typeof ts === 'string') readAt[id] = ts;
    }
  } catch { /* fall through to an empty read model */ }
  return readAt;
}
async function loadIdList(metaKey: string, prefix: string, fallback: string[]): Promise<string[]> {
  const rawMeta = await SecureStore.getItemAsync(metaKey);
  const count = rawMeta ? Number.parseInt(rawMeta, 10) : 0;
  if (!Number.isFinite(count) || count <= 0) return fallback;
  const ids: string[] = [];
  for (let index = 0; index < count; index += 1) {
    const raw = await SecureStore.getItemAsync(`${prefix}${index}`);
    if (!raw) continue;
    try {
      const value: unknown = JSON.parse(raw);
      if (Array.isArray(value)) for (const id of value) if (typeof id === 'string') ids.push(id);
    } catch { /* ignore a corrupt chunk; other chunks remain usable */ }
  }
  return ids;
}
async function loadState(): Promise<NotificationPresentationState> {
  try {
    const raw = await SecureStore.getItemAsync(PRESENTATION_KEY);
    if (raw) { const value: unknown = JSON.parse(raw); if (value && typeof value === 'object' && !Array.isArray(value)) { const v = value as Partial<NotificationPresentationState>; const readAt = await loadReadAt(); const archivedFallback = Array.isArray(v.archived) ? v.archived.filter((id): id is string => typeof id === 'string') : []; const clearedFallback = Array.isArray(v.cleared) ? v.cleared.filter((id): id is string => typeof id === 'string') : []; const archived = await loadIdList(ARCHIVED_META_KEY, ARCHIVED_CHUNK_PREFIX, archivedFallback); const cleared = await loadIdList(CLEARED_META_KEY, CLEARED_CHUNK_PREFIX, clearedFallback); return { readAt, archived, cleared }; } }
    const readAt = Object.fromEntries((await legacyIds()).map((id) => [id, new Date().toISOString()])); return { ...EMPTY, readAt };
  } catch { return { ...EMPTY, readAt: {} }; }
}
async function saveState(state: NotificationPresentationState): Promise<void> {
  const entries = Object.entries(state.readAt);
  const chunks: Record<string, string>[] = [];
  let chunk: Record<string, string> = {};
  for (const [id, ts] of entries) {
    const candidate = { ...chunk, [id]: ts };
    if (Object.keys(chunk).length > 0 && JSON.stringify(candidate).length > READ_AT_CHUNK_CHARS) { chunks.push(chunk); chunk = { [id]: ts }; } else chunk = candidate;
  }
  if (Object.keys(chunk).length > 0) chunks.push(chunk);
  await Promise.all(chunks.map((value, index) => SecureStore.setItemAsync(`${READ_AT_CHUNK_PREFIX}${index}`, JSON.stringify(value))));
  // Publish the count only after all chunks are durable; a partial write then
  // continues to use the previous complete set rather than losing read state.
  await SecureStore.setItemAsync(READ_AT_META_KEY, String(chunks.length));
  const saveIds = async (ids: string[], metaKey: string, prefix: string): Promise<void> => {
    const idChunks: string[][] = [];
    let idChunk: string[] = [];
    for (const id of ids) {
      const candidate = [...idChunk, id];
      if (idChunk.length > 0 && JSON.stringify(candidate).length > READ_AT_CHUNK_CHARS) { idChunks.push(idChunk); idChunk = [id]; } else idChunk = candidate;
    }
    if (idChunk.length > 0) idChunks.push(idChunk);
    await Promise.all(idChunks.map((value, index) => SecureStore.setItemAsync(`${prefix}${index}`, JSON.stringify(value))));
    await SecureStore.setItemAsync(metaKey, String(idChunks.length));
  };
  await Promise.all([saveIds(state.archived, ARCHIVED_META_KEY, ARCHIVED_CHUNK_PREFIX), saveIds(state.cleared, CLEARED_META_KEY, CLEARED_CHUNK_PREFIX)]);
  await SecureStore.setItemAsync(PRESENTATION_KEY, JSON.stringify({ archived: [], cleared: [] }));
}
export function pruneNotificationPresentationState(state: NotificationPresentationState, nowMs = Date.now()): NotificationPresentationState { const cutoff = nowMs - RETENTION_MS; const expired = new Set<string>(); const readAt: Record<string, string> = {}; for (const [id, ts] of Object.entries(state.readAt)) { if (Date.parse(ts) >= cutoff) readAt[id] = ts; else expired.add(id); } const cleared = new Set(state.cleared); expired.forEach((id) => cleared.add(id)); return { readAt, archived: state.archived.filter((id) => !expired.has(id)), cleared: [...cleared] }; }
async function clean(): Promise<NotificationPresentationState> { const state = await loadState(); const next = pruneNotificationPresentationState(state); if (JSON.stringify(next) !== JSON.stringify(state)) await saveState(next); return next; }
export function buildNotificationContentId(profileId: string, category: string, title: string): string { return `${profileId}:${category}:${title}`; }
export async function getReadNotificationIds(): Promise<Set<string>> { return new Set(Object.keys((await clean()).readAt)); }
export async function markNotificationRead(id: string): Promise<void> { const state = await clean(); if (!state.readAt[id]) await saveState({ ...state, readAt: { ...state.readAt, [id]: new Date().toISOString() } }); }
export async function getArchivedNotificationIds(): Promise<Set<string>> { return new Set((await clean()).archived); }
export async function getClearedNotificationIds(): Promise<Set<string>> { return new Set((await clean()).cleared); }
export async function archiveNotifications(ids: string[]): Promise<void> { const state = await clean(); const set = new Set(state.archived); ids.forEach((id) => set.add(id)); await saveState({ ...state, archived: [...set] }); }
export async function clearNotifications(ids: string[]): Promise<void> { const state = await clean(); const set = new Set(state.cleared); ids.forEach((id) => set.add(id)); await saveState({ ...state, cleared: [...set] }); }
