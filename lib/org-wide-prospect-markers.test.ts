import { describe, expect, it, vi } from 'vitest';

const rpcMock = vi.fn();
vi.mock('./supabase', () => ({ supabase: { rpc: (...args: unknown[]) => rpcMock(...args) } }));

import { getOrgWideProspectMarkers } from './org-wide-prospect-markers';

describe('getOrgWideProspectMarkers', () => {
  it('maps remote rows to typed markers', async () => {
    rpcMock.mockResolvedValueOnce({
      data: [{ id: 'c1', lat: 14.5, lng: 121.0, label: 'Acme Corp' }],
      error: null,
    });

    const result = await getOrgWideProspectMarkers();

    expect(rpcMock).toHaveBeenCalledWith('get_org_wide_prospect_map_markers');
    expect(result).toEqual([{ id: 'c1', lat: 14.5, lng: 121.0, label: 'Acme Corp' }]);
  });

  it('drops rows missing lat/lng and falls back label to "Unknown client"', async () => {
    rpcMock.mockResolvedValueOnce({
      data: [
        { id: 'c1', lat: null, lng: 121.0, label: 'Has no lat' },
        { id: 'c2', lat: 14.5, lng: null, label: 'Has no lng' },
        { id: 'c3', lat: 14.5, lng: 121.0, label: null },
      ],
      error: null,
    });

    const result = await getOrgWideProspectMarkers();

    expect(result).toEqual([{ id: 'c3', lat: 14.5, lng: 121.0, label: 'Unknown client' }]);
  });

  it('returns an empty array when data is null', async () => {
    rpcMock.mockResolvedValueOnce({ data: null, error: null });
    expect(await getOrgWideProspectMarkers()).toEqual([]);
  });

  it('throws the Supabase error rather than swallowing it', async () => {
    rpcMock.mockResolvedValueOnce({ data: null, error: new Error('rpc failed') });
    await expect(getOrgWideProspectMarkers()).rejects.toThrow('rpc failed');
  });
});
