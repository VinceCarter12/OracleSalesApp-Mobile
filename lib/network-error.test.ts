import { describe, expect, it } from 'vitest';
import { isNetworkConnectivityError } from './network-error';

describe('isNetworkConnectivityError', () => {
  // B-087: RN normalizes DNS/radio-level drops (e.g. Android
  // UnknownHostException) to generic TypeError/"Network request failed"
  // messages — this only needs to catch that shape, not the original
  // platform exception.
  it('recognizes RN\'s generic fetch-failure TypeError', () => {
    expect(isNetworkConnectivityError(new TypeError('Network request failed'))).toBe(true);
  });

  it('recognizes DNS-failure message text', () => {
    expect(isNetworkConnectivityError(new Error('Unable to resolve host "x.supabase.co"'))).toBe(true);
  });

  it('recognizes withTimeout()\'s own timeout message', () => {
    expect(isNetworkConnectivityError(new Error('coldStartGetSession timed out after 8000ms'))).toBe(true);
  });

  it('does not treat an unrelated Error as a network failure', () => {
    expect(isNetworkConnectivityError(new Error('column "foo" does not exist'))).toBe(false);
  });

  it('handles non-Error thrown values without crashing', () => {
    expect(isNetworkConnectivityError('some string')).toBe(false);
    expect(isNetworkConnectivityError(null)).toBe(false);
  });
});
