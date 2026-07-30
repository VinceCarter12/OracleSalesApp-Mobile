import { beforeEach, describe, expect, it, vi } from 'vitest';

// expo-secure-store is a native module (its build/ExpoSecureStore binding
// only resolves inside an Expo runtime) — it cannot be imported for real
// under plain vitest/node, so it's mocked with a tiny in-memory store here.
// This lets writeSnapshot/readSnapshot/clearSnapshot be exercised end to
// end, including the Zod validation boundary, without a device/emulator.
const memoryStore = new Map<string, string>();

vi.mock('expo-secure-store', () => ({
  getItemAsync: vi.fn((key: string) => Promise.resolve(memoryStore.get(key) ?? null)),
  setItemAsync: vi.fn((key: string, value: string) => {
    memoryStore.set(key, value);
    return Promise.resolve();
  }),
  deleteItemAsync: vi.fn((key: string) => {
    memoryStore.delete(key);
    return Promise.resolve();
  }),
}));

const { writeSnapshot, readSnapshot, clearSnapshot } = await import('./session-snapshot');

const validInput = {
  userId: 'auth-user-1',
  profileId: 'profile-1',
  role: 'sales_specialist' as const,
  teamId: 'team-1',
  fullName: 'Test Agent',
};

beforeEach(() => {
  memoryStore.clear();
});

describe('writeSnapshot / readSnapshot round-trip', () => {
  it('reads back exactly what was written, plus a schemaVersion and cachedAt', async () => {
    await writeSnapshot(validInput);
    const result = await readSnapshot();

    expect(result).not.toBeNull();
    expect(result?.userId).toBe(validInput.userId);
    expect(result?.profileId).toBe(validInput.profileId);
    expect(result?.role).toBe(validInput.role);
    expect(result?.teamId).toBe(validInput.teamId);
    expect(result?.fullName).toBe(validInput.fullName);
    expect(result?.schemaVersion).toBe(1);
    expect(typeof result?.cachedAt).toBe('string');
  });

  it('supports a null teamId (e.g. an unassigned manager/executive)', async () => {
    await writeSnapshot({ ...validInput, teamId: null });
    const result = await readSnapshot();
    expect(result?.teamId).toBeNull();
  });
});

describe('readSnapshot validation (SecureStore is a trust boundary)', () => {
  it('returns null when no snapshot has ever been written', async () => {
    expect(await readSnapshot()).toBeNull();
  });

  it('returns null for malformed (non-JSON) stored content, never throws', async () => {
    memoryStore.set('oracle_sales_session_snapshot', 'not-json{{{');
    await expect(readSnapshot()).resolves.toBeNull();
  });

  it('returns null when a required field is missing', async () => {
    memoryStore.set(
      'oracle_sales_session_snapshot',
      JSON.stringify({ schemaVersion: 1, userId: 'u1', role: 'sales_specialist', teamId: null, cachedAt: 'x' })
    );
    expect(await readSnapshot()).toBeNull();
  });

  it('returns null for an unknown role value', async () => {
    memoryStore.set(
      'oracle_sales_session_snapshot',
      JSON.stringify({
        schemaVersion: 1,
        userId: 'u1',
        profileId: 'p1',
        role: 'not_a_real_role',
        teamId: null,
        fullName: 'x',
        cachedAt: '2026-07-30T00:00:00.000Z',
      })
    );
    expect(await readSnapshot()).toBeNull();
  });

  it('returns null for a mismatched schemaVersion (forces a clean re-login instead of misreading an old shape)', async () => {
    memoryStore.set(
      'oracle_sales_session_snapshot',
      JSON.stringify({
        schemaVersion: 999,
        userId: 'u1',
        profileId: 'p1',
        role: 'sales_specialist',
        teamId: null,
        fullName: 'x',
        cachedAt: '2026-07-30T00:00:00.000Z',
      })
    );
    expect(await readSnapshot()).toBeNull();
  });
});

describe('clearSnapshot', () => {
  it('removes a previously written snapshot', async () => {
    await writeSnapshot(validInput);
    expect(await readSnapshot()).not.toBeNull();

    await clearSnapshot();
    expect(await readSnapshot()).toBeNull();
  });

  it('is a no-op (does not throw) when nothing was ever written', async () => {
    await expect(clearSnapshot()).resolves.toBeUndefined();
  });
});
