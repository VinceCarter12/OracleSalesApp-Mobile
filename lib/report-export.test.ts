import { describe, expect, it } from 'vitest';
import { buildReportCsv, type ReportExportInput } from './report-csv';

const BASE: ReportExportInput = {
  scopeLabel: 'Buong kumpanya',
  timeframeLabel: 'This month',
  summary: { totalMeetings: 3, successful: 2, newClientsAcquired: 1, lostOpportunities: 0 },
  rows: [
    { companyName: 'Acme Corp', agentName: 'J. Cruz', managerName: 'M. Reyes', date: 'Aug 3', location: 'Makati HQ', outcome: 'success' },
  ],
  generatedAt: new Date('2026-08-10T00:00:00.000Z'),
};

describe('buildReportCsv', () => {
  it('emits summary + meetings sections with a header row', () => {
    const csv = buildReportCsv(BASE);
    const lines = csv.split('\n');
    expect(lines[0]).toBe('Company-wide Report');
    expect(lines).toContain('Scope,Buong kumpanya');
    expect(lines).toContain('Timeframe,This month');
    expect(lines).toContain('Generated,2026-08-10T00:00:00.000Z');
    expect(lines).toContain('Total meetings,3');
    expect(lines).toContain('Company,Agent,Manager,Date,Location,Outcome');
    expect(lines).toContain('Acme Corp,J. Cruz,M. Reyes,Aug 3,Makati HQ,success');
  });

  it('escapes commas, quotes, and newlines per RFC-4180', () => {
    const csv = buildReportCsv({
      ...BASE,
      rows: [
        { companyName: 'Smith, Jones & Co', agentName: 'A "Ace" Dizon', managerName: 'Line1\nLine2', date: 'Aug 4', location: 'Cebu', outcome: 'lost' },
      ],
    });
    expect(csv).toContain('"Smith, Jones & Co"');
    expect(csv).toContain('"A ""Ace"" Dizon"');
    expect(csv).toContain('"Line1\nLine2"');
  });

  it('produces only the section scaffold when there are no meeting rows', () => {
    const csv = buildReportCsv({ ...BASE, rows: [] });
    const lines = csv.split('\n');
    // Last line is the meetings header — nothing after it.
    expect(lines[lines.length - 1]).toBe('Company,Agent,Manager,Date,Location,Outcome');
  });
});
