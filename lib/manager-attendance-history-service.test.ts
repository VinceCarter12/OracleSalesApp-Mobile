import { describe, expect, it } from 'vitest';
import { vi } from 'vitest';
vi.mock('./db', () => ({ getDb: vi.fn() }));
import { dedupeAttendanceRecords, type ManagerAttendanceRecord } from './manager-attendance-history-service';

const record = (id: string, participated = false): ManagerAttendanceRecord => ({
  id, clientId: null, clientName: id, agentId: 'agent', loggedAt: id,
  meetingMode: null, selfieUrl: null, startPhotoUrl: null, endPhotoUrl: null,
  syncStatus: 'synced', participated,
  decisionStatus: participated ? 'accepted' : 'mine',
});

describe('manager attendance history', () => {
  it('dedupes a canonical meeting when own and accepted participation overlap', () => {
    expect(dedupeAttendanceRecords([record('m1'), record('m1', true), record('m2', true)]).map((row) => row.id)).toEqual(['m1', 'm2']);
  });

  it('binds mine to the manager and does not add participation predicates', async () => {
    const getAllAsync = vi.fn().mockResolvedValue([]);
    const db = { getAllAsync };
    const { getManagerAttendanceHistory } = await import('./manager-attendance-history-service');
    await getManagerAttendanceHistory('manager-1', 'mine', db);
    expect(getAllAsync).toHaveBeenCalledWith(expect.not.stringContaining('client_creation'), ['manager-1', 'manager-1']);
    expect(getAllAsync.mock.calls[0]?.[0]).toContain('m.agent_id = ?');
  });

  it('combined binds manager owner and accepted meeting-context invitee', async () => {
    const getAllAsync = vi.fn().mockResolvedValue([]);
    const db = { getAllAsync };
    const { getManagerAttendanceHistory } = await import('./manager-attendance-history-service');
    await getManagerAttendanceHistory('manager-2', 'combined', db);
    const [sql, args] = getAllAsync.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain("tar.context = 'meeting'");
    expect(sql).toContain("tar.status <> 'cancelled'");
    expect(sql).not.toContain('client_creation');
    expect(args).toEqual(['manager-2', 'manager-2', 'manager-2']);
  });

  it.each(['pending', 'accepted', 'declined'] as const)('includes %s manager decision status', async (status) => {
    const getAllAsync = vi.fn().mockResolvedValue([{
      id: `meeting-${status}`, client_id: 'client-1', client_name: 'Acme', agent_id: 'sales-1',
      logged_at: '2026-08-14T01:00:00Z', meeting_mode: 'client', selfie_url: null,
      start_photo_url: null, end_photo_url: null, sync_status: 'synced', request_status: status,
    }]);
    const { getManagerAttendanceHistory } = await import('./manager-attendance-history-service');
    const rows = await getManagerAttendanceHistory('manager-2', 'combined', { getAllAsync });
    expect(rows[0]?.decisionStatus).toBe(status);
  });

  it('excludes cancelled manager selections in SQL', async () => {
    const getAllAsync = vi.fn().mockResolvedValue([]);
    const { getManagerAttendanceHistory } = await import('./manager-attendance-history-service');
    await getManagerAttendanceHistory('manager-2', 'combined', { getAllAsync });
    expect(getAllAsync.mock.calls[0]?.[0]).toContain("tar.status <> 'cancelled'");
  });
});
