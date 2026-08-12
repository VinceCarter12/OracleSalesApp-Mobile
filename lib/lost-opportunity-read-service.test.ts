import { beforeEach, describe, expect, it, vi } from 'vitest';

interface QueryResult<T> {
  data: T[] | null;
  error: { message: string } | null;
}

type ClientRow = Record<string, unknown>;
type CycleRow = { client_id: string };
type ProfileRow = Record<string, unknown>;

let clientsResult: QueryResult<ClientRow>;
let cyclesResult: QueryResult<CycleRow>;
let profilesResult: QueryResult<ProfileRow>;

// Captures the MOST RECENT query builder instance per table so tests can
// assert what `.eq()`/`.in()`/etc. were actually CALLED WITH (not just what
// they resolve to) — see quality-gate bug 2 (2026-08-02): without this, a
// mock that ignores its call args and always returns itself would let the
// production code query the wrong column/filter and still pass every test.
let lastClientsQuery: ReturnType<typeof makeClientsQuery>;
let lastCyclesQuery: ReturnType<typeof makeCyclesQuery>;
let lastProfilesQuery: ReturnType<typeof makeProfilesQuery>;

function makeClientsQuery() {
  const query = {
    eq: vi.fn(() => query),
    lte: vi.fn(() => query),
    neq: vi.fn(() => query),
    in: vi.fn(() => query),
    then: (resolve: (value: QueryResult<ClientRow>) => void) => resolve(clientsResult),
  };
  return query;
}

function makeCyclesQuery() {
  const query = {
    eq: vi.fn(() => query),
    then: (resolve: (value: QueryResult<CycleRow>) => void) => resolve(cyclesResult),
  };
  return query;
}

function makeProfilesQuery() {
  const query = {
    eq: vi.fn(() => query),
    in: vi.fn(() => query),
    then: (resolve: (value: QueryResult<ProfileRow>) => void) => resolve(profilesResult),
  };
  return query;
}

const fromMock = vi.fn((table: 'clients' | 'client_cycles' | 'profiles') => ({
  select: vi.fn(() => {
    if (table === 'clients') {
      lastClientsQuery = makeClientsQuery();
      return lastClientsQuery;
    }
    if (table === 'client_cycles') {
      lastCyclesQuery = makeCyclesQuery();
      return lastCyclesQuery;
    }
    lastProfilesQuery = makeProfilesQuery();
    return lastProfilesQuery;
  }),
}));

vi.mock('./supabase', () => ({
  supabase: { from: (table: 'clients' | 'client_cycles' | 'profiles') => fromMock(table) },
}));

const { fetchLostOpportunities } = await import('./lost-opportunity-read-service');

const NOW = new Date('2026-08-02T00:00:00.000Z');
const PAST = '2026-07-01T00:00:00.000Z'; // reassignable already, i.e. "available"
const FUTURE = '2026-09-01T00:00:00.000Z'; // still cooling

function clientRow(overrides: Partial<ClientRow> = {}): ClientRow {
  return {
    id: 'client-1',
    company_name: 'Prime Build Supply',
    city: 'Cebu City',
    sales_channel: 'Distributor',
    lost_at: '2026-06-01T00:00:00.000Z',
    reassignable_at: PAST,
    inactive_reason: '6 months no meeting',
    contact_person: 'Juan Dela Cruz',
    contact_position: 'Owner',
    office_address: '123 Rizal St',
    office_lat: 10.3,
    office_lng: 123.9,
    office_pin_source: 'client_office_meeting',
    assigned_agent_id: 'agent-1',
    ...overrides,
  };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
  fromMock.mockClear();
  clientsResult = { data: [clientRow()], error: null };
  cyclesResult = { data: [], error: null };
  profilesResult = { data: [], error: null };
});

describe("fetchLostOpportunities scope: 'claimable' (Sales/RSR)", () => {
  it('maps a lost client row into a record marked available', async () => {
    const items = await fetchLostOpportunities({ scope: 'claimable', profileId: 'agent-2' });
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      id: 'client-1',
      companyName: 'Prime Build Supply',
      city: 'Cebu City',
      channel: 'Distributor',
      reason: '6 months no meeting',
      officePinVerified: true,
      availability: 'available',
    });
  });

  // Ported from lib/lost-opportunity-list-service.test.ts (Step C) onto the
  // shared service — same Migration 062 behavior, not a new test.
  it('excludes a client the caller previously lost, in ANY prior cycle (Migration 062)', async () => {
    clientsResult = {
      data: [clientRow({ id: 'client-1' }), clientRow({ id: 'client-2', company_name: 'Other Co' })],
      error: null,
    };
    cyclesResult = { data: [{ client_id: 'client-1' }], error: null };

    const items = await fetchLostOpportunities({ scope: 'claimable', profileId: 'agent-2' });
    expect(items.map((i) => i.id)).toEqual(['client-2']);

    // Pins the actual filter columns/values Migration 062's historical
    // exclusion depends on — a regression to e.g. `agent_id` or a dropped
    // `end_reason` clause would silently stop excluding prior-cycle losses
    // without this assertion failing.
    expect(lastCyclesQuery.eq).toHaveBeenCalledWith('owner_id', 'agent-2');
    expect(lastCyclesQuery.eq).toHaveBeenCalledWith('end_reason', 'lost');
  });

  it('propagates a clients query error', async () => {
    clientsResult = { data: null, error: { message: 'boom' } };
    await expect(fetchLostOpportunities({ scope: 'claimable', profileId: 'agent-2' })).rejects.toBeTruthy();
  });

  it('propagates a client_cycles query error', async () => {
    cyclesResult = { data: null, error: { message: 'boom' } };
    await expect(fetchLostOpportunities({ scope: 'claimable', profileId: 'agent-2' })).rejects.toBeTruthy();
  });
});

describe("fetchLostOpportunities scope: 'team' (Manager)", () => {
  it('uses server RLS for the team boundary and includes BOTH available and cooling records', async () => {
    profilesResult = {
      data: [{ id: 'agent-1', full_name: 'Agent One', role: 'sales_specialist', team_id: 'team-1' }],
      error: null,
    };
    clientsResult = {
      data: [
        clientRow({ id: 'client-1', reassignable_at: PAST }),
        clientRow({ id: 'client-2', company_name: 'Cooling Co', reassignable_at: FUTURE }),
      ],
      error: null,
    };

    const items = await fetchLostOpportunities({ scope: 'team', teamId: 'team-1', managerProfileId: 'mgr-1' });
    expect(items.map((i) => ({ id: i.id, availability: i.availability }))).toEqual([
      { id: 'client-1', availability: 'available' },
      { id: 'client-2', availability: 'cooling' },
    ]);

    // Pins the roster-then-clients filter shape: team roster scoped by
    // `team_id`/agent roles, then clients scoped by `status='lost'` and
    // `assigned_agent_id IN (roster + manager)` — a regression to e.g. a
    // dropped `status` filter or the wrong id column would silently widen
    // or break the Manager scope without this assertion catching it.
    expect(lastClientsQuery.eq).toHaveBeenCalledWith('status', 'lost');
    expect(lastClientsQuery.in).not.toHaveBeenCalled();
  });

  it('includes a cooling row even when the owner is absent from the roster response', async () => {
    profilesResult = {
      data: [
        { id: 'agent-1', full_name: 'Agent One', role: 'sales_specialist', team_id: 'team-1' },
        { id: 'mgr-2', full_name: 'Manager Two', role: 'sales_manager', team_id: 'team-1' },
      ],
      error: null,
    };
    clientsResult = {
      data: [clientRow({ id: 'manager-owned-cooling', assigned_agent_id: 'mgr-2', reassignable_at: FUTURE })],
      error: null,
    };

    const items = await fetchLostOpportunities({ scope: 'team', teamId: 'team-1', managerProfileId: 'mgr-1' });
    expect(items).toEqual([
      expect.objectContaining({ id: 'manager-owned-cooling', availability: 'cooling' }),
    ]);
    expect(lastClientsQuery.in).not.toHaveBeenCalled();
    // The roster query remains explicitly team-bound, so a profile from a
    // different team can never enter the assigned-agent IN list.
    expect(lastClientsQuery.eq).toHaveBeenCalledWith('status', 'lost');
  });

  it('does not query profiles for team scope; RLS remains the boundary', async () => {
    // Manager id is always included, so roster is never truly empty in
    // practice — this asserts the clients query still runs scoped to just
    // the manager rather than skipping/broadening unexpectedly.
    const items = await fetchLostOpportunities({ scope: 'team', teamId: 'team-1', managerProfileId: 'mgr-1' });
    expect(fromMock).toHaveBeenCalledWith('clients');
    expect(Array.isArray(items)).toBe(true);
    expect(lastClientsQuery.eq).toHaveBeenCalledWith('status', 'lost');
    expect(fromMock).not.toHaveBeenCalledWith('profiles');
  });
});

describe("fetchLostOpportunities scope: 'company' (Executive) — equivalence with the deleted lib/executive-lost-opportunity-service.ts", () => {
  it('derives available/cooling from reassignable_at and joins agent + manager profiles, unscoped', async () => {
    profilesResult = {
      data: [
        { id: 'agent-1', full_name: 'Agent One', role: 'sales_specialist', team_id: 'team-1' },
        { id: 'mgr-1', full_name: 'Manager One', role: 'sales_manager', team_id: 'team-1' },
      ],
      error: null,
    };
    clientsResult = {
      data: [
        clientRow({ id: 'client-1', assigned_agent_id: 'agent-1', reassignable_at: PAST }),
        clientRow({ id: 'client-2', company_name: 'Cooling Co', assigned_agent_id: 'agent-1', reassignable_at: FUTURE }),
        clientRow({ id: 'client-3', company_name: 'No Timestamp Co', assigned_agent_id: 'agent-1', reassignable_at: null }),
      ],
      error: null,
    };

    const items = await fetchLostOpportunities({ scope: 'company' });

    // Same output the old fetchExecutiveLostOpportunities() produced for
    // identical input: unscoped (no eq/in filter narrowing by team/agent),
    // agent/manager name join, and the same null-safe "cooling" default.
    expect(items).toEqual([
      expect.objectContaining({ id: 'client-1', agentName: 'Agent One', managerName: 'Manager One', availability: 'available' }),
      expect.objectContaining({ id: 'client-2', agentName: 'Agent One', managerName: 'Manager One', availability: 'cooling' }),
      expect.objectContaining({ id: 'client-3', agentName: 'Agent One', managerName: 'Manager One', availability: 'cooling' }),
    ]);
  });

  it('leaves agent/manager name null when no matching profile is found', async () => {
    profilesResult = { data: [], error: null };
    clientsResult = { data: [clientRow({ assigned_agent_id: 'orphan-agent' })], error: null };

    const items = await fetchLostOpportunities({ scope: 'company' });
    expect(items[0]).toMatchObject({ agentName: null, managerId: null, managerName: null });
  });
});
