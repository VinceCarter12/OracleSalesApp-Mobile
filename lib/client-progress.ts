import type { Client, Meeting } from '../types';
import { PRESENTATION_AGENDA } from '../types';

export interface InfoChecklistItem {
  key: 'name' | 'contact' | 'number' | 'address' | 'channel';
  label: string;
  done: boolean;
}

/** Wireframe a-detail info-completion checklist: name/contact/number/address/channel. */
export function getInfoChecklist(client: Client): InfoChecklistItem[] {
  return [
    { key: 'name', label: 'Company name', done: Boolean(client.company_name) },
    { key: 'contact', label: 'Contact person (decision-maker)', done: Boolean(client.contact_person) },
    { key: 'number', label: 'Contact number', done: Boolean(client.contact_number) },
    { key: 'address', label: 'Office address', done: Boolean(client.office_address) },
    { key: 'channel', label: 'Sales channel', done: Boolean(client.sales_channel) },
  ];
}

export function isInfoComplete(client: Client): boolean {
  return getInfoChecklist(client).every((item) => item.done);
}

export interface ClientProgressBreakdown {
  presented: boolean;
  total: number;
}

/**
 * Progress % is driven solely by Record Meeting → Agenda: 100% once a saved
 * meeting's agenda includes "Product / company presentation," 0% otherwise.
 * Info completion (getInfoChecklist above) has ZERO weight here — it's a
 * separate data-quality gate (1-month rule), not a progress contributor
 * (B-001, corrected 2026-07-11 per direct client instruction — an earlier
 * same-day blended 80% info + 20% presentation formula was itself wrong and
 * was rejected; do not reintroduce it).
 */
export function getClientProgressBreakdown(client: Client, meetings: Meeting[]): ClientProgressBreakdown {
  const presented = meetings.some(
    (m) => m.client_id === client.id && m.agendas.includes(PRESENTATION_AGENDA)
  );
  return { presented, total: presented ? 100 : 0 };
}

export function getClientProgress(client: Client, meetings: Meeting[]): number {
  return getClientProgressBreakdown(client, meetings).total;
}
