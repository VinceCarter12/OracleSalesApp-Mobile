import { describe, expect, it } from 'vitest';
import {
  applyJitterMs,
  BACKOFF_MULTIPLIER,
  BASELINE_MAX_MS,
  BASELINE_MIN_MS,
  MAX_IDLE_INTERVAL_MS,
  nextIdleIntervalMs,
  pickBaselineIntervalMs,
} from './adaptive-sync-interval';

describe('pickBaselineIntervalMs', () => {
  it('is never the old fixed 10-second interval', () => {
    for (const r of [0, 0.25, 0.5, 0.75, 0.999]) {
      expect(pickBaselineIntervalMs(() => r)).not.toBe(10_000);
    }
  });

  it('stays within the 30-60s baseline range', () => {
    expect(pickBaselineIntervalMs(() => 0)).toBe(BASELINE_MIN_MS);
    expect(pickBaselineIntervalMs(() => 0.999999)).toBeLessThan(BASELINE_MAX_MS + 1);
    expect(pickBaselineIntervalMs(() => 0.5)).toBeGreaterThanOrEqual(BASELINE_MIN_MS);
    expect(pickBaselineIntervalMs(() => 0.5)).toBeLessThanOrEqual(BASELINE_MAX_MS);
  });
});

describe('nextIdleIntervalMs', () => {
  it('backs off (doubles) on repeated zero-change passes', () => {
    const baseline = 30_000;
    let interval = baseline;
    interval = nextIdleIntervalMs(interval, false, baseline);
    expect(interval).toBe(baseline * BACKOFF_MULTIPLIER);
    interval = nextIdleIntervalMs(interval, false, baseline);
    expect(interval).toBe(baseline * BACKOFF_MULTIPLIER * BACKOFF_MULTIPLIER);
  });

  it('caps backoff at MAX_IDLE_INTERVAL_MS', () => {
    const baseline = 60_000;
    let interval = baseline;
    for (let i = 0; i < 10; i++) {
      interval = nextIdleIntervalMs(interval, false, baseline);
    }
    expect(interval).toBe(MAX_IDLE_INTERVAL_MS);
  });

  it('resets to baseline the moment a pass has changes, from any backed-off interval', () => {
    const baseline = 30_000;
    const grown = nextIdleIntervalMs(nextIdleIntervalMs(baseline, false, baseline), false, baseline);
    expect(grown).toBeGreaterThan(baseline);
    expect(nextIdleIntervalMs(grown, true, baseline)).toBe(baseline);
  });
});

describe('applyJitterMs', () => {
  it('never goes below the minimum scheduled delay', () => {
    expect(applyJitterMs(1_500, () => 0, 5_000)).toBeGreaterThanOrEqual(1_000);
  });

  it('stays within +/- jitterMs of the base interval', () => {
    const base = 30_000;
    const jitter = 5_000;
    expect(applyJitterMs(base, () => 0, jitter)).toBe(base - jitter);
    expect(applyJitterMs(base, () => 1, jitter)).toBe(base + jitter);
    expect(applyJitterMs(base, () => 0.5, jitter)).toBe(base);
  });
});
