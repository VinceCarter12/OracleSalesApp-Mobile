import type { Client, Meeting } from '../types';
import { CLOSE_DEAL_AGENDA, MEETING_AGENDAS, PRESENTATION_AGENDA } from '../types';
import { getClientStatus } from './client-status';

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

export interface QualifiedAgendaMilestones {
  completed: number;
  total: number;
  percent: number;
}

// Wireframe #a-clients' `aProspectMilestones`/`aComputeProgressBreakdown` —
// the 6 agenda topics (every MEETING_AGENDAS entry except the terminal
// "Close deal") whose coverage across a client's real recorded meetings
// drives the My Clients list's "Qualified agenda progress" meter and
// "{completed}/6 agenda milestones" copy for Prospect/In Progress cards.
// Distinct from getClientProgressBreakdown above (B-001's presentation-only
// gate) — this is the list-card display metric only, not a re-litigation of
// that decision.
const QUALIFIED_AGENDA_MILESTONES = MEETING_AGENDAS.filter((agenda) => agenda !== CLOSE_DEAL_AGENDA);

export function getQualifiedAgendaMilestones(client: Client, meetings: Meeting[]): QualifiedAgendaMilestones {
  const covered = new Set<string>();
  meetings.forEach((m) => {
    if (m.client_id !== client.id) return;
    m.agendas.forEach((agenda) => covered.add(agenda));
  });
  const completed = QUALIFIED_AGENDA_MILESTONES.filter((agenda) => covered.has(agenda)).length;
  const total = QUALIFIED_AGENDA_MILESTONES.length;
  return { completed, total, percent: Math.round((completed / total) * 100) };
}

export interface ClientJourneyProgress {
  percent: number;
  label: string;
}

/**
 * Meeting Detail's selected-client progress card and the Client Journey
 * summary card (2026-08-04 handoff) — mirrors the wireframe's
 * `aClientProgressPercent(c)` (Wireframe-Sales-BizLink.html:1652-1655) for
 * the percentage, reusing the EXISTING `getQualifiedAgendaMilestones()`
 * above rather than recomputing agenda coverage, plus the label pairing
 * used at both its Meeting Detail (line 2050) and Client Journey (line 2076)
 * call sites. Distinct from `getClientProgressBreakdown` above (B-001's
 * separate presentation-only 0/100 gate, used elsewhere) — do not conflate
 * the two metrics.
 */
export function getClientJourneyProgress(client: Client, meetings: Meeting[]): ClientJourneyProgress {
  const status = getClientStatus(client);
  const percent = status === 'new' || status === 'existing'
    ? 100
    : getQualifiedAgendaMilestones(client, meetings).percent;
  const label = status === 'prospect' || status === 'in_progress'
    ? 'Qualified agenda progress'
    : 'Lifecycle complete';
  return { percent, label };
}
