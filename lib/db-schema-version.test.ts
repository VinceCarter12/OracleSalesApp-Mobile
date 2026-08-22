import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * B-124 regression guard.
 *
 * `runMigrations()` returns early on `currentVersion >= LATEST_SCHEMA_VERSION`.
 * If that constant ever drifts BELOW the highest version the migration blocks
 * can reach, those blocks become unreachable and every device silently stays
 * on the older schema — no error, no log, no failing test. That is exactly how
 * the `'duplicate_blocked'` CHECK constraint never reached any device, which
 * in turn made PO confirmations vanish with no row and no error.
 *
 * This asserts the constant against the source itself rather than importing
 * `lib/db.ts` (which pulls in expo-sqlite and its native module) — the check is
 * a textual invariant, so reading the file keeps the test dependency-free.
 */
describe('LATEST_SCHEMA_VERSION (B-124)', () => {
  const source = readFileSync(join(__dirname, 'db.ts'), 'utf8');

  function declaredLatestVersion(): number {
    const match = source.match(/const LATEST_SCHEMA_VERSION = (\d+);/);
    expect(match, 'LATEST_SCHEMA_VERSION declaration not found in lib/db.ts').not.toBeNull();
    return Number(match?.[1]);
  }

  /** Every `currentVersion = N;` assignment inside runMigrations() — the versions the blocks can actually reach. */
  function reachableVersions(): number[] {
    return [...source.matchAll(/^\s*currentVersion = (\d+);/gm)].map((m) => Number(m[1]));
  }

  it('is at least as high as the highest version the migration blocks reach', () => {
    const reachable = reachableVersions();
    expect(reachable.length, 'no `currentVersion = N;` assignments found — did runMigrations() change shape?').toBeGreaterThan(0);
    // Not `toBe`: a constant ABOVE the blocks is harmless (no migration to
    // run). A constant BELOW them is the silent failure this guards against.
    expect(declaredLatestVersion()).toBeGreaterThanOrEqual(Math.max(...reachable));
  });

  it('has a migration block for every version below it, so no step is skipped', () => {
    const latest = declaredLatestVersion();
    const handled = new Set([...source.matchAll(/if \(currentVersion === (\d+)\)/g)].map((m) => Number(m[1])));
    // The oldest handled version is the floor: anything below it is a
    // pre-history device handled by the initial-create path, not by a step.
    const floor = Math.min(...handled);
    const missing = Array.from({ length: latest - floor }, (_, i) => floor + i).filter((v) => !handled.has(v));
    expect(missing, `no migration block advances past version(s) ${missing.join(', ')}`).toEqual([]);
  });
});
