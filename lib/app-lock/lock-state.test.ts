import { describe, expect, it } from 'vitest';
import { computeLockEnabled, shouldRelock } from './lock-state';

describe('computeLockEnabled', () => {
  it('is enabled only when flag, preference, and capability all agree', () => {
    expect(computeLockEnabled({ flagEnabled: true, userPreferenceEnabled: true, capability: 'biometric' })).toBe(true);
    expect(computeLockEnabled({ flagEnabled: true, userPreferenceEnabled: true, capability: 'device_credential' })).toBe(true);
  });

  it('is disabled when the rollout flag is off, even if the user opted in', () => {
    expect(computeLockEnabled({ flagEnabled: false, userPreferenceEnabled: true, capability: 'biometric' })).toBe(false);
  });

  it('is disabled when the user preference is off, even if the flag is on', () => {
    expect(computeLockEnabled({ flagEnabled: true, userPreferenceEnabled: false, capability: 'biometric' })).toBe(false);
  });

  it('is disabled when the device has no enrolled credential, regardless of flag/preference', () => {
    expect(computeLockEnabled({ flagEnabled: true, userPreferenceEnabled: true, capability: 'none' })).toBe(false);
  });
});

describe('shouldRelock', () => {
  const ONE_HOUR_MS = 60 * 60 * 1000;

  it('never relocks if the app has not been backgrounded yet', () => {
    expect(shouldRelock(null, Date.now(), ONE_HOUR_MS)).toBe(false);
  });

  it('does not relock before the window elapses', () => {
    const now = 10_000_000;
    expect(shouldRelock(now - (ONE_HOUR_MS - 1), now, ONE_HOUR_MS)).toBe(false);
  });

  it('relocks once the window has fully elapsed', () => {
    const now = 10_000_000;
    expect(shouldRelock(now - ONE_HOUR_MS, now, ONE_HOUR_MS)).toBe(true);
  });

  it('relocks when well past the window (e.g. app backgrounded overnight)', () => {
    const now = 10_000_000;
    expect(shouldRelock(now - ONE_HOUR_MS * 8, now, ONE_HOUR_MS)).toBe(true);
  });
});
