import { beforeEach, describe, expect, it, vi } from 'vitest';

interface QueryResult<T> {
  data: T[] | null;
  error: { message: string } | null;
}

let clientsResult: QueryResult<Record<string, unknown>>;
let cyclesResult: QueryResult<{ client_id: string }>;
let meetingsResult: QueryResult<Record<string, unknown>>;

function makeClientsQuery() {
  const query = {
    eq: vi.fn(() => query),
    lte: vi.fn(() => query),
    neq: vi.fn(() => query),
    then: (resolve: (value: QueryResult<Record<string, unknown>>) => void) => resolve(clientsResult),
  };
  return query;
}

function makeCyclesQuery() {
  const query = {
    eq: vi.fn(() => query),
    then: (resolve: (value: QueryResult<{ client_id: string }>) => void) => resolve(cyclesResult),
  };
  return query;
}

function makeMeetingsQuery() {
  const query = {
    eq: vi.fn(() => query),
    order: vi.fn(() => query),
    limit: vi.fn(() => query),
    then: (resolve: (value: QueryResult<Record<string, unknown>>) => void) => resolve(meetingsResult),
  };
  return query;
}

const fromMock = vi.fn((table: 'clients' | 'client_cycles' | 'meetings') => ({
  select: vi.fn(() => {
    if (table === 'clients') return makeClientsQuery();
    if (table === 'client_cycles') return makeCyclesQuery();
    return makeMeetingsQuery();
  }),
}));

vi.mock('./supabase', () => ({
  supabase: { from: (table: 'clients' | 'client_cycles' | 'meetings') => fromMock(table) },
}));

const { fetchClaimableLostOpportunities, fetchLastMeetingSummary } = await import('./lost-opportunity-list-service');

function clientRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'client-1',
    company_name: 'Prime Build Supply',
    city: 'Cebu City',
    sales_channel: 'Distributor',
    lost_at: '2026-06-01T00:00:00.000Z',
    inactive_reason: '6 months no meeting',
    contact_person: 'Juan Dela Cruz',
    contact_position: 'Owner',
    office_address: '123 Rizal St',
    office_lat: 10.3,
    office_lng: 123.9,
    office_pin_source: 'client_office_meeting',
    ...overrides,
  };
}

beforeEach(() => {
  fromMock.mockClear();
  clientsResult = { data: [clientRow()], error: null };
  cyclesResult = { data: [], error: null };
  meetingsResult = { data: [], error: null };
});

describe('fetchClaimableLostOpportunities', () => {
  it('maps a lost client row into a list item', async () => {
    const items = await fetchClaimableLostOpportunities('agent-2');
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      id: 'client-1',
      companyName: 'Prime Build Supply',
      city: 'Cebu City',
      channel: 'Distributor',
      reason: '6 months no meeting',
      officePinVerified: true,
    });
  });

  it('excludes a client the caller previously lost, in ANY prior cycle (Migration 062)', async () => {
    clientsResult = {
      data: [clientRow({ id: 'client-1' }), clientRow({ id: 'client-2', company_name: 'Other Co' })],
      error: null,
    };
    cyclesResult = { data: [{ client_id: 'client-1' }], error: null };

    const items = await fetchClaimableLostOpportunities('agent-2');
    expect(items.map((i) => i.id)).toEqual(['client-2']);
  });

  it('propagates a clients query error', async () => {
    clientsResult = { data: null, error: { message: 'boom' } };
    await expect(fetchClaimableLostOpportunities('agent-2')).rejects.toBeTruthy();
  });

  it('propagates a client_cycles query error', async () => {
    cyclesResult = { data: null, error: { message: 'boom' } };
    await expect(fetchClaimableLostOpportunities('agent-2')).rejects.toBeTruthy();
  });
});

describe('fetchLastMeetingSummary', () => {
  it('returns null when there is no meeting on file', async () => {
    const result = await fetchLastMeetingSummary('client-1');
    expect(result).toBeNull();
  });

  it('prefers remarks, falls back to outcome then agenda', async () => {
    meetingsResult = {
      data: [{ meeting_date: '2026-05-01T00:00:00.000Z', agenda: ['Intro'], remarks: 'Discussed pricing', outcome: 'Follow-up Required' }],
      error: null,
    };
    const result = await fetchLastMeetingSummary('client-1');
    expect(result).toEqual({ meetingDate: '2026-05-01T00:00:00.000Z', summary: 'Discussed pricing' });
  });
});
