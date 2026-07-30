import * as SecureStore from 'expo-secure-store';
import { z } from 'zod';
import type { UserRole } from '../../types';

// Batch 5 Slice 1 (ADR-051): SecureStore-backed snapshot of the signed-in
// profile, written at sign-in and read on cold start to rehydrate
// `lib/session-store.tsx` without forcing a fresh Supabase re-login. This is
// a trust boundary (SecureStore contents are opaque device storage, not
// server-verified) — every read is Zod-validated, never cast.

const SNAPSHOT_KEY = 'oracle_sales_session_snapshot';

// Bump this whenever SessionSnapshotSchema's shape changes in a
// backward-incompatible way — readSnapshot() treats a version mismatch the
// same as a corrupt/missing snapshot (returns null, forces signed_out).
const SNAPSHOT_SCHEMA_VERSION = 1;

// Mirrors `types/index.ts`'s `UserRole` union. Kept as a separate literal
// tuple (not derived) so Zod can validate against it at the SecureStore
// trust boundary — same manual-sync convention as
// `lib/wipe-local-data.ts`'s `TABLES_TO_WIPE`. Update together with
// `UserRole` if that union ever changes.
const SNAPSHOT_ROLE_VALUES = [
  'sales_specialist',
  'rsr',
  'sales_manager',
  'executive',
  'admin',
  'superadmin',
  'collector',
  'delivery',
] as const satisfies readonly UserRole[];

const SessionSnapshotSchema = z.object({
  schemaVersion: z.literal(SNAPSHOT_SCHEMA_VERSION),
  userId: z.string().min(1),
  profileId: z.string().min(1),
  role: z.enum(SNAPSHOT_ROLE_VALUES),
  teamId: z.string().min(1).nullable(),
  fullName: z.string(),
  cachedAt: z.string().min(1),
});

export type SessionSnapshot = z.infer<typeof SessionSnapshotSchema>;

export type WritableSessionSnapshot = Omit<SessionSnapshot, 'schemaVersion' | 'cachedAt'>;

/** Persists the current signed-in profile as a validated SecureStore snapshot. Call once per successful sign-in. */
export async function writeSnapshot(input: WritableSessionSnapshot): Promise<void> {
  const snapshot: SessionSnapshot = {
    ...input,
    schemaVersion: SNAPSHOT_SCHEMA_VERSION,
    cachedAt: new Date().toISOString(),
  };
  await SecureStore.setItemAsync(SNAPSHOT_KEY, JSON.stringify(snapshot));
}

/**
 * Reads and Zod-validates the SecureStore snapshot. Never throws — any
 * missing key, malformed JSON, schema-version mismatch, or validation
 * failure resolves to `null` so callers can safely treat it as
 * "no usable snapshot, fall back to signed_out".
 */
export async function readSnapshot(): Promise<SessionSnapshot | null> {
  try {
    const raw = await SecureStore.getItemAsync(SNAPSHOT_KEY);
    if (!raw) return null;

    const parsed: unknown = JSON.parse(raw);
    const result = SessionSnapshotSchema.safeParse(parsed);
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}

/** Clears the snapshot. Must be called from EVERY sign-out path — a stale snapshot silently re-signs-in the previous user on next cold start. */
export async function clearSnapshot(): Promise<void> {
  await SecureStore.deleteItemAsync(SNAPSHOT_KEY);
}
