import { describe, expect, it } from 'vitest';
import { matchesManagerClientReportSearch, matchesManagerReportSearch } from './manager-report-filter';

const agents = [{ id: 'agent-1', name: 'Maria Santos', initials: 'MS', meetingsThisMonth: 0, activeClients: 0, successRate: 0 }];
const clients = [{ id: 'client-1', name: 'Northwind Trading', agentId: 'agent-1', status: 'new' as const, channel: 'Distributor', checklist: { name: true, contact: false, number: false, address: false, channel: true }, deadline: '—' }];
const meeting = { id: 'meeting-1', clientId: 'client-1', agentId: 'agent-1', date: 'Aug 10', time: '9:00 AM', location: 'Client Office', contact: '—', position: '—', custType: 'New', agenda: [], remarks: '', outcome: 'success' as const, meetingMode: 'in_person' as const, gps: '', tagAlong: false, synced: true };

describe('Manager Reports search', () => {
  it('matches a manager-entered agent or client name', () => {
    expect(matchesManagerReportSearch('maria', meeting, clients, agents)).toBe(true);
    expect(matchesManagerReportSearch('northwind', meeting, clients, agents)).toBe(true);
  });

  it('does not expose an unrelated record through search', () => {
    expect(matchesManagerReportSearch('unrelated', meeting, clients, agents)).toBe(false);
    expect(matchesManagerClientReportSearch('unrelated', clients[0], agents)).toBe(false);
  });
});
