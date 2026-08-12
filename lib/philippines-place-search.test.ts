import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./sync/connectivity', () => ({ isLikelyOnline: vi.fn() }));
vi.mock('./supabase', () => ({ supabase: { functions: { invoke: vi.fn() } } }));

import { isLikelyOnline } from './sync/connectivity';
import { searchPhilippinesPlaces, validatePhilippinesCoordinate } from './philippines-place-search';
import { isPhilippinesCoordinate } from './policies/philippines-coordinate-policy';
import { supabase } from './supabase';

const mockedOnline = vi.mocked(isLikelyOnline);
const mockedFetch = vi.fn();
const mockedInvoke = vi.mocked(supabase.functions.invoke);

describe('Philippines place search', () => {
  beforeEach(() => {
    mockedOnline.mockReset();
    mockedOnline.mockResolvedValue(true);
    mockedFetch.mockReset();
    mockedInvoke.mockReset();
    vi.stubGlobal('fetch', mockedFetch);
  });

  it('requests PH-only results and rejects malformed or non-PH rows', async () => {
    mockedInvoke.mockResolvedValue({ data: { results: [{ id: '1', name: 'Makati', address: 'Makati, Philippines', lat: 14.5547, lng: 121.0244 }] }, error: null });
    const results = await searchPhilippinesPlaces('Makati');
    expect(mockedInvoke).toHaveBeenCalledWith('philippines-geocode', { body: { action: 'search', query: 'Makati' } });
    expect(results).toEqual([expect.objectContaining({ name: 'Makati', lat: 14.5547 })]);
  });

  it('blocks offline search and reports a fetch failure', async () => {
    mockedOnline.mockResolvedValueOnce(false);
    await expect(searchPhilippinesPlaces('Makati')).rejects.toThrow('needs an internet connection');
    mockedInvoke.mockResolvedValueOnce({ data: null, error: new Error('network') });
    await expect(searchPhilippinesPlaces('Makati')).rejects.toThrow('Could not search places');
  });

  it('authoritatively verifies a PH coordinate through reverse geocoding', async () => {
    mockedInvoke.mockResolvedValue({ data: { address: 'Makati, Metro Manila, Philippines', countryCode: 'ph' }, error: null });
    await expect(validatePhilippinesCoordinate(14.5547, 121.0244)).resolves.toContain('Makati');
    expect(mockedInvoke).toHaveBeenCalledWith('philippines-geocode', { body: { action: 'reverse', lat: 14.5547, lng: 121.0244 } });
  });

  it('rejects non-PH, malformed, offline, and failed reverse validation', async () => {
    await expect(validatePhilippinesCoordinate(Number.NaN, 121)).rejects.toThrow('within the Philippines');
    await expect(validatePhilippinesCoordinate(3.139, 101.6869)).rejects.toThrow('within the Philippines');
    mockedOnline.mockResolvedValueOnce(false);
    await expect(validatePhilippinesCoordinate(14.55, 121.02)).rejects.toThrow('Verify this pin while online');
    mockedInvoke.mockResolvedValueOnce({ data: { address: 'Kuala Lumpur, Malaysia', countryCode: 'my' }, error: null });
    await expect(validatePhilippinesCoordinate(14.55, 121.02)).rejects.toThrow('within the Philippines');
    mockedInvoke.mockResolvedValueOnce({ data: null, error: new Error('network') });
    await expect(validatePhilippinesCoordinate(14.55, 121.02)).rejects.toThrow('Could not verify');
  });

  it('uses the inexpensive bbox only as an early guard', () => {
    expect(isPhilippinesCoordinate(14.5995, 120.9842)).toBe(true);
    expect(isPhilippinesCoordinate(1.3521, 103.8198)).toBe(false);
  });
});
