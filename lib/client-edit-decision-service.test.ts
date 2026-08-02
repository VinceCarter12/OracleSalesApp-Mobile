import { beforeEach, describe, expect, it, vi } from 'vitest';

// lib/supabase.ts transitively imports react-native — mocked the same way
// lib/app-lock/account-status.test.ts does, so the RPC wrapper's I/O shell
// can be exercised without a real Supabase client.
let rpcImpl: () => Promise<{ data: unknown; error: { message: string } | null }>;
const rpc = vi.fn((_fn: string, _args: Record<string, unknown>) => rpcImpl());

vi.mock('./supabase', () => ({
  supabase: { rpc: (fn: string, args: Record<string, unknown>) => rpc(fn, args) },
}));

const { decideClientEditRequest, UnknownClientEditDecisionCodeError } = await import('./client-edit-decision-service');

beforeEach(() => {
  rpc.mockClear();
});

describe('decideClientEditRequest', () => {
  it('calls decide_client_edit_request with the exact p_request_id/p_decision/p_note args', async () => {
    rpcImpl = () => Promise.resolve({ data: 'approved', error: null });
    await decideClientEditRequest('req-1', 'approved', 'looks good');
    expect(rpc).toHaveBeenCalledWith('decide_client_edit_request', {
      p_request_id: 'req-1',
      p_decision: 'approved',
      p_note: 'looks good',
    });
  });

  it.each(['approved', 'rejected', 'already_decided', 'base_conflict', 'role_not_eligible', 'not_found', 'invalid_decision'])(
    'returns the domain code %s as a value, never throws for it',
    async (code) => {
      rpcImpl = () => Promise.resolve({ data: code, error: null });
      await expect(decideClientEditRequest('req-1', 'approved', null)).resolves.toBe(code);
    }
  );

  it('throws on a transport-level error from the RPC call', async () => {
    rpcImpl = () => Promise.resolve({ data: null, error: { message: 'network down' } });
    await expect(decideClientEditRequest('req-1', 'approved', null)).rejects.toEqual({ message: 'network down' });
  });

  it('throws UnknownClientEditDecisionCodeError on an unrecognized response', async () => {
    rpcImpl = () => Promise.resolve({ data: 'some_future_code', error: null });
    await expect(decideClientEditRequest('req-1', 'approved', null)).rejects.toBeInstanceOf(
      UnknownClientEditDecisionCodeError
    );
  });
});
