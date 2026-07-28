import { describe, expect, it, vi } from 'vitest';

// outbox-status.ts's classification logic is pure, but the module also
// imports entity-registry.ts (for markOutboxRow/etc, not used by these
// tests) which transitively pulls in expo-secure-store -> react-native's
// Flow-syntax source, which vitest/rolldown can't parse. Stubbing this one
// (unused-here) import keeps the test scoped to the pure functions below
// without dragging in native-module code, same pattern as ADR-037's vitest
// scoping note (pure modules only).
vi.mock('./entity-registry', () => ({ isEntityTableName: () => false }));

import { classifySyncError, RATE_LIMIT_STATUS_CODE, UNIQUE_VIOLATION_CODE, RLS_PERMISSION_DENIED_CODE } from './outbox-status';

// ADR-036 (Batch 3): 'rate_limited' is a distinct FailureClass from 'server',
// detected via the HTTP status remote-upsert.ts now attaches to thrown
// errors — never guessed from message text, since PostgREST/Kong doesn't
// consistently shape 429 response bodies.
describe('classifySyncError', () => {
  it('classifies a 429-status error as rate_limited and transient (retryable)', () => {
    const result = classifySyncError({ message: 'Too Many Requests', status: RATE_LIMIT_STATUS_CODE });
    expect(result.failureClass).toBe('rate_limited');
    expect(result.kind).toBe('transient');
  });

  it('classifies a message-only 429-shaped error without a status field as unknown, not rate_limited', () => {
    // Guards against accidentally reintroducing message-text sniffing for 429 —
    // the status field is the only reliable signal per ADR-036.
    const result = classifySyncError({ message: 'Too Many Requests' });
    expect(result.failureClass).toBe('unknown');
  });

  it('still classifies a 5xx message as server (unaffected by the rate_limited addition)', () => {
    const result = classifySyncError({ message: 'upstream connect error 503' });
    expect(result.failureClass).toBe('server');
    expect(result.kind).toBe('transient');
  });

  it('still classifies a network-pattern message as network', () => {
    const result = classifySyncError({ message: 'network request failed' });
    expect(result.failureClass).toBe('network');
    expect(result.kind).toBe('transient');
  });

  it('still classifies a unique-violation code as conflict, even if status happens to be set', () => {
    const result = classifySyncError({ code: UNIQUE_VIOLATION_CODE, message: 'duplicate key', status: 409 });
    expect(result.failureClass).toBe('conflict');
    expect(result.kind).toBe('conflict');
  });

  it('still classifies an RLS-denied code as authentication, taking priority over a coincidental 429 status', () => {
    const result = classifySyncError({ code: RLS_PERMISSION_DENIED_CODE, message: 'permission denied', status: RATE_LIMIT_STATUS_CODE });
    expect(result.failureClass).toBe('authentication');
  });

  it('classifies an unrecognized error with no code/status/matching message as unknown', () => {
    const result = classifySyncError({ message: 'something odd happened' });
    expect(result.failureClass).toBe('unknown');
    expect(result.kind).toBe('permanent');
  });
});
