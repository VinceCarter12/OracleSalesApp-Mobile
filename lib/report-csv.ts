// Pure CSV assembly for the Executive Reports export — deliberately free of
// any expo-*/native import so it stays unit-testable under vitest's node
// environment (see vitest.config.ts's "pure function tests only" note). The
// file-write + share side of the export lives in lib/report-export.ts, which
// imports these builders.

export interface ReportExportRow {
  companyName: string;
  agentName: string;
  managerName: string;
  date: string;
  location: string;
  outcome: string;
}

export interface ReportExportInput {
  /** e.g. "Buong kumpanya" or a specific manager's team name. */
  scopeLabel: string;
  /** Human-readable timeframe, e.g. "This month" or "Aug 1 – Aug 10, 2026". */
  timeframeLabel: string;
  summary: {
    totalMeetings: number;
    successful: number;
    newClientsAcquired: number;
    lostOpportunities: number;
  };
  rows: ReportExportRow[];
  /** Injected in tests for a deterministic "Generated" line; defaults to now. */
  generatedAt?: Date;
}

/** RFC-4180 field escaping: wrap in quotes and double any embedded quote when the value contains a comma, quote, or newline. */
function csvField(value: string | number): string {
  const s = String(value ?? '');
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function csvRow(fields: (string | number)[]): string {
  return fields.map(csvField).join(',');
}

/** Builds the full CSV text (no BOM — that is added at write time in `exportReportCsv`). Pure + deterministic given `generatedAt`. */
export function buildReportCsv(input: ReportExportInput): string {
  const generated = (input.generatedAt ?? new Date()).toISOString();
  const lines: string[] = [
    csvRow(['Company-wide Report']),
    csvRow(['Scope', input.scopeLabel]),
    csvRow(['Timeframe', input.timeframeLabel]),
    csvRow(['Generated', generated]),
    '',
    csvRow(['Summary']),
    csvRow(['Total meetings', input.summary.totalMeetings]),
    csvRow(['Successful', input.summary.successful]),
    csvRow(['New clients acquired', input.summary.newClientsAcquired]),
    csvRow(['Lost opportunities', input.summary.lostOpportunities]),
    '',
    csvRow(['Meetings']),
    csvRow(['Company', 'Agent', 'Manager', 'Date', 'Location', 'Outcome']),
    ...input.rows.map((r) =>
      csvRow([r.companyName, r.agentName, r.managerName, r.date, r.location, r.outcome])
    ),
  ];
  return lines.join('\n');
}
