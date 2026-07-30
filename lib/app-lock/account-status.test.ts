import { beforeEach, describe, expect, it, vi } from 'vitest';

// lib/supabase.ts transitively imports react-native (Platform), which
// vitest/rolldown cannot parse — mocked here the same way session-snapshot's
// expo-secure-store mock works, so verifyAccountActive()'s I/O shell can
// still be exercised end to end without a real Supabase client.
interface ProfileQueryData {
  is_active: boolean;
  user_id?: string;
  role?: string;
  team_id?: string | null;
  full_name?: string | null;
}

let maybeSingleImpl: () => Promise<{ data: ProfileQueryData | null; error: { message: string } | null }>;
const maybeSingle = vi.fn(() => maybeSingleImpl());
const eq = vi.fn(() => ({ maybeSingle }));
const select = vi.fn(() => ({ eq }));
const from = vi.fn((_table: string) => ({ select }));

vi.mock('../supabase', () => ({
  supabase: { from: (table: string) => from(table) },
}));

const { verifyAccountActive, verifyAccountActiveWithProfile, AccountSuspendedError } = await import('./account-status');

beforeEach(() => {
  from.mockClear();
  select.mockClear();
  eq.mockClear();
  maybeSingle.mockClear();
});

describe('verifyAccountActive', () => {
  it('resolves active for a successful is_active: true response', async () => {
    maybeSingleImpl = () => Promise.resolve({ data: { is_active: true }, error: null });
    expect(await verifyAccountActive('profile-active')).toBe('active');
  });

  it('resolves suspended for a successful is_active: false response', async () => {
    maybeSingleImpl = () => Promise.resolve({ data: { is_active: false }, error: null });
    expect(await verifyAccountActive('profile-suspended')).toBe('suspended');
  });

  it('fails OPEN to unverified (never suspended) when the query times out', async () => {
    maybeSingleImpl = () => new Promise(() => {}); // never resolves
    expect(await verifyAccountActive('profile-timeout', 10)).toBe('unverified');
  });

  it('fails OPEN to unverified on a thrown/rejected query', async () => {
    maybeSingleImpl = () => Promise.reject(new Error('network down'));
    expect(await verifyAccountActive('profile-network-error', 50)).toBe('unverified');
  });

  it('single-flights concurrent calls for the same profileId (one network call, not two)', async () => {
    let resolveOnce: (v: { data: { is_active: boolean } | null; error: null }) => void = () => {};
    maybeSingleImpl = () => new Promise((resolve) => { resolveOnce = resolve; });

    const first = verifyAccountActive('profile-dedupe');
    const second = verifyAccountActive('profile-dedupe');
    expect(from).toHaveBeenCalledTimes(1);

    resolveOnce({ data: { is_active: true }, error: null });
    expect(await first).toBe('active');
    expect(await second).toBe('active');
    expect(from).toHaveBeenCalledTimes(1);
  });

  it('allows a fresh network call once the previous in-flight check for that profileId resolved', async () => {
    maybeSingleImpl = () => Promise.resolve({ data: { is_active: true }, error: null });
    await verifyAccountActive('profile-sequential');
    await verifyAccountActive('profile-sequential');
    expect(from).toHaveBeenCalledTimes(2);
  });

  it('AccountSuspendedError carries a clear admin-deactivation message', () => {
    const err = new AccountSuspendedError();
    expect(err.name).toBe('AccountSuspendedError');
    expect(err.message).toMatch(/deactivated/i);
  });
});

describe('verifyAccountActiveWithProfile', () => {
  it('returns status active and a mapped profile snapshot on a successful active response', async () => {
    maybeSingleImpl = () =>
      Promise.resolve({
        data: { is_active: true, user_id: 'auth-1', role: 'sales_specialist', team_id: 'team-1', full_name: 'Test Agent' },
        error: null,
      });

    const result = await verifyAccountActiveWithProfile('profile-with-active');
    expect(result.status).toBe('active');
    expect(result.profile).toEqual({ userId: 'auth-1', role: 'sales_specialist', teamId: 'team-1', fullName: 'Test Agent' });
  });

  it('returns status suspended with no profile snapshot', async () => {
    maybeSingleImpl = () =>
      Promise.resolve({
        data: { is_active: false, user_id: 'auth-2', role: 'rsr', team_id: null, full_name: 'Suspended Agent' },
        error: null,
      });

    const result = await verifyAccountActiveWithProfile('profile-with-suspended');
    expect(result.status).toBe('suspended');
    expect(result.profile).toBeNull();
  });

  it('fails open to unverified with no profile snapshot on a timeout', async () => {
    maybeSingleImpl = () => new Promise(() => {});
    const result = await verifyAccountActiveWithProfile('profile-with-timeout', 10);
    expect(result.status).toBe('unverified');
    expect(result.profile).toBeNull();
  });
});
