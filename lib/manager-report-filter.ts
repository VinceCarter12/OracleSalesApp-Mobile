import type { TeamAgent, TeamClient, TeamMeeting } from '../types';

/** Categories are intentionally export-facing. The dashboard cards remain a
 * complete overview, while the workbook contains only the categories chosen
 * by the manager. */
export const MANAGER_REPORT_EXPORT_CATEGORIES = ['meetings', 'successful', 'new_clients', 'lost'] as const;

export type ManagerReportExportCategory = (typeof MANAGER_REPORT_EXPORT_CATEGORIES)[number];

export const MANAGER_REPORT_CATEGORY_LABELS: Record<ManagerReportExportCategory, string> = {
  meetings: 'Meetings',
  successful: 'Successful',
  new_clients: 'New clients',
  lost: 'Lost opportunities',
};

function normalized(value: string | undefined): string {
  return (value ?? '').trim().toLocaleLowerCase();
}

export function matchesManagerReportSearch(
  query: string,
  meeting: TeamMeeting,
  clients: TeamClient[],
  agents: TeamAgent[]
): boolean {
  const needle = normalized(query);
  if (!needle) return true;
  const client = clients.find((candidate) => candidate.id === meeting.clientId);
  const agent = agents.find((candidate) => candidate.id === meeting.agentId);
  return [client?.name, agent?.name, meeting.location, meeting.date].some((value) => normalized(value).includes(needle));
}

export function matchesManagerClientReportSearch(
  query: string,
  client: TeamClient,
  agents: TeamAgent[]
): boolean {
  const needle = normalized(query);
  if (!needle) return true;
  const agent = agents.find((candidate) => candidate.id === client.agentId);
  return [client.name, agent?.name, client.status, client.channel].some((value) => normalized(value).includes(needle));
}
