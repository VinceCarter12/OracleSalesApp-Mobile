import { COLORS } from './theme';
import type { Client, ClientStatus } from '../types';

/**
 * Resolves a client's lifecycle status. Records without a status column
 * (schema pending, T-001) fall back to 'prospect' so they can never reach
 * the photo-only fast path — the safe default against form-skipping.
 */
export function getClientStatus(client: Pick<Client, 'status'>): ClientStatus {
  return client.status ?? 'prospect';
}

/** Mirrors .b-prospect/.b-new/.b-existing in Wireframe-Agent-Executive.html (ADR-010/011). */
export const CLIENT_STATUS_BADGES: Record<
  ClientStatus,
  { label: string; background: string; color: string }
> = {
  prospect: { label: 'PROSPECT', background: COLORS.blueSoft, color: COLORS.blue },
  new: { label: 'NEW', background: COLORS.greenSoft, color: COLORS.ledgeGreen },
  existing: { label: 'EXISTING', background: COLORS.polar, color: COLORS.wolf },
  inactive: { label: 'INACTIVE', background: COLORS.swan, color: COLORS.wolf },
};
