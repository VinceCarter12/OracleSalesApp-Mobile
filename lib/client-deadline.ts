import type { Client } from '../types';

const DAY_MS = 24 * 60 * 60 * 1000;
const WARN_THRESHOLD_DAYS = 7;

export interface ClientDeadlineInfo {
  label: string;
  warn: boolean;
}

/**
 * Wireframe #a-clients' deadline countdown (My Clients list). No formula
 * exists in the wireframe itself (its demo data hardcodes literal strings) —
 * this is an implementer judgment call, not a re-derived spec: overdue/≤7
 * days shows a short "N days left" red warning, further out shows a
 * "Mon D (N days)" label. Returns null when there's no deadline to show
 * (non-prospect clients, or `details_deadline_at` not yet synced).
 */
export function getClientDeadlineInfo(client: Client): ClientDeadlineInfo | null {
  if (!client.details_deadline_at) return null;
  const deadline = new Date(client.details_deadline_at);
  if (Number.isNaN(deadline.getTime())) return null;

  const daysLeft = Math.ceil((deadline.getTime() - Date.now()) / DAY_MS);

  if (daysLeft <= 0) {
    return { label: 'Overdue', warn: true };
  }
  if (daysLeft <= WARN_THRESHOLD_DAYS) {
    return { label: `${daysLeft} day${daysLeft === 1 ? '' : 's'} left`, warn: true };
  }
  const dateLabel = deadline.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  return { label: `${dateLabel} (${daysLeft} days)`, warn: false };
}
