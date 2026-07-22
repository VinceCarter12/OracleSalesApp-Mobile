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

/**
 * F-204: an OVERLAY badge, not a `ClientStatus` value — Migration 023 gates
 * the prospect→new auto-promotion server-side on there being no pending
 * manager tag-along for the client's meeting; this is the mobile-side
 * display of that same condition (see
 * `lib/tag-along-service.ts#getClientIdsWithPendingManagerTagAlong`). Uses
 * the BizLink amber/yellow tokens already established for warning/deadline
 * treatments (`amberSoft`/`orange`), not a new color.
 */
export const WAITING_MANAGER_APPROVAL_BADGE = {
  label: 'Waiting for Manager Approval',
  background: 'amberSoft' as const,
  color: 'orange' as const,
};
