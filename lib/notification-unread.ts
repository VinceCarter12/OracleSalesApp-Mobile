import * as SecureStore from 'expo-secure-store';

const READ_IDS_KEY = 'oracle_notification_read_ids_v1';
const PRESENTATION_KEY = 'oracle_notification_presentation_v1';
const RETENTION_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_TRACKED = 12;
const EMPTY = { readAt: {} as Record<string, string>, archived: [] as string[], cleared: [] as string[] };
export interface NotificationPresentationState { readAt: Record<string, string>; archived: string[]; cleared: string[] }

async function legacyIds(): Promise<string[]> { try { const raw = await SecureStore.getItemAsync(READ_IDS_KEY); const value: unknown = raw ? JSON.parse(raw) : []; return Array.isArray(value) ? value.filter((id): id is string => typeof id === 'string') : []; } catch { return []; } }
async function loadState(): Promise<NotificationPresentationState> {
  try {
    const raw = await SecureStore.getItemAsync(PRESENTATION_KEY);
    if (raw) { const value: unknown = JSON.parse(raw); if (value && typeof value === 'object' && !Array.isArray(value)) { const v = value as Partial<NotificationPresentationState>; const readAt: Record<string, string> = {}; if (v.readAt && typeof v.readAt === 'object') for (const [id, ts] of Object.entries(v.readAt)) if (typeof ts === 'string') readAt[id] = ts; return { readAt, archived: Array.isArray(v.archived) ? v.archived.filter((id): id is string => typeof id === 'string') : [], cleared: Array.isArray(v.cleared) ? v.cleared.filter((id): id is string => typeof id === 'string') : [] }; } }
    const readAt = Object.fromEntries((await legacyIds()).map((id) => [id, new Date().toISOString()])); return { ...EMPTY, readAt };
  } catch { return { ...EMPTY, readAt: {} }; }
}
async function saveState(state: NotificationPresentationState): Promise<void> { await SecureStore.setItemAsync(PRESENTATION_KEY, JSON.stringify({ readAt: Object.fromEntries(Object.entries(state.readAt).slice(-MAX_TRACKED)), archived: state.archived.slice(-MAX_TRACKED), cleared: state.cleared.slice(-MAX_TRACKED) })); }
export function pruneNotificationPresentationState(state: NotificationPresentationState, nowMs = Date.now()): NotificationPresentationState { const cutoff = nowMs - RETENTION_MS; const expired = new Set<string>(); const readAt: Record<string, string> = {}; for (const [id, ts] of Object.entries(state.readAt)) { if (Date.parse(ts) >= cutoff) readAt[id] = ts; else expired.add(id); } const cleared = new Set(state.cleared); expired.forEach((id) => cleared.add(id)); return { readAt, archived: state.archived.filter((id) => !expired.has(id)), cleared: [...cleared] }; }
async function clean(): Promise<NotificationPresentationState> { const state = await loadState(); const next = pruneNotificationPresentationState(state); if (JSON.stringify(next) !== JSON.stringify(state)) await saveState(next); return next; }
export function buildNotificationContentId(profileId: string, category: string, title: string): string { return `${profileId}:${category}:${title}`; }
export async function getReadNotificationIds(): Promise<Set<string>> { return new Set(Object.keys((await clean()).readAt)); }
export async function markNotificationRead(id: string): Promise<void> { const state = await clean(); if (!state.readAt[id]) await saveState({ ...state, readAt: { ...state.readAt, [id]: new Date().toISOString() } }); }
export async function getArchivedNotificationIds(): Promise<Set<string>> { return new Set((await clean()).archived); }
export async function getClearedNotificationIds(): Promise<Set<string>> { return new Set((await clean()).cleared); }
export async function archiveNotifications(ids: string[]): Promise<void> { const state = await clean(); const set = new Set(state.archived); ids.forEach((id) => set.add(id)); await saveState({ ...state, archived: [...set] }); }
export async function clearNotifications(ids: string[]): Promise<void> { const state = await clean(); const set = new Set(state.cleared); ids.forEach((id) => set.add(id)); await saveState({ ...state, cleared: [...set] }); }
