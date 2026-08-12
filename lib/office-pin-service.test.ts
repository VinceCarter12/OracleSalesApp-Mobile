import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getDb, enqueueOutboxRow, isLikelyOnline, runSync } = vi.hoisted(() => ({
  getDb: vi.fn(),
  enqueueOutboxRow: vi.fn(),
  isLikelyOnline: vi.fn(),
  runSync: vi.fn(),
}));

vi.mock('./db', () => ({ getDb }));
vi.mock('./sync/entity-registry', () => ({ enqueueOutboxRow }));
vi.mock('./sync/connectivity', () => ({ isLikelyOnline }));
vi.mock('./sync-engine', () => ({ runSync }));
vi.mock('./uuid', () => ({ uuidv4: vi.fn(() => 'outbox-1') }));

import {
  assertOfficePinCoordinateWithinPhilippines,
  setOfficeLocation,
  writeOfficePinLocal,
} from './office-pin-service';

const validInput = {
  clientId: 'client-1',
  agentId: 'agent-1',
  lat: 14.5547,
  lng: 121.0244,
  source: 'manual' as const,
};

describe('office pin local coordinate guard', () => {
  beforeEach(() => {
    getDb.mockReset();
    enqueueOutboxRow.mockReset();
    isLikelyOnline.mockReset();
    runSync.mockReset();
  });

  it('accepts a finite coordinate within the Philippine bounding box', () => {
    expect(() => assertOfficePinCoordinateWithinPhilippines(validInput.lat, validInput.lng)).not.toThrow();
  });

  it('rejects malformed and clearly non-PH coordinates', () => {
    expect(() => assertOfficePinCoordinateWithinPhilippines(Number.NaN, 121.0244)).toThrow('within the Philippines');
    expect(() => assertOfficePinCoordinateWithinPhilippines(1.3521, 103.8198)).toThrow('within the Philippines');
  });

  it('does not write SQLite or enqueue an outbox update for a rejected direct local write', async () => {
    const db = { runAsync: vi.fn() } as unknown as Parameters<typeof writeOfficePinLocal>[0];

    await expect(writeOfficePinLocal(db, { ...validInput, lat: 1.3521, lng: 103.8198 })).rejects.toThrow('within the Philippines');

    expect(db.runAsync).not.toHaveBeenCalled();
    expect(enqueueOutboxRow).not.toHaveBeenCalled();
    expect(isLikelyOnline).not.toHaveBeenCalled();
  });

  it('rejects before opening SQLite or starting background sync through the public API', async () => {
    await expect(setOfficeLocation({ ...validInput, lat: 3.139, lng: 101.6869 })).rejects.toThrow('within the Philippines');

    expect(getDb).not.toHaveBeenCalled();
    expect(runSync).not.toHaveBeenCalled();
  });
});
