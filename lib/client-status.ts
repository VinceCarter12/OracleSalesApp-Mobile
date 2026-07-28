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

/**
 * Mirrors .b-prospect/.b-new/.b-existing in Wireframe-Agent-Executive.html
 * (ADR-010/011). `in_progress` added for ADR-042's four-stage lifecycle
 * (2026-07-27) — matches Manager wireframe's `.b-follow{background:var(
 * --amber-soft);color:#B4740A}` (Wireframe-Manager-BizLink.html:95), which is
 * `COLORS.orange`, by reusing the app's existing amber/orange
 * "in-progress-ish" pairing already established for
 * `WAITING_MANAGER_APPROVAL_BADGE` and the 'Follow-up Required' outcome
 * badge, rather than inventing a new hex value.
 *
 * This object is consumed by BOTH Sales (`app/(tabs)/**`) and Manager
 * (`app/(manager)/**`) screens, but the two wireframes specify different
 * `in_progress` shades: Sales' `.b-progress{background:var(--amber-soft);
 * color:#8A5A06}` (Wireframe-Sales-BizLink.html:84) vs Manager's `.b-follow`
 * above (`#B4740A`). This shared map matches Manager's color (already equal
 * to `COLORS.orange`) — `SALES_CLIENT_STATUS_BADGES` below overrides just
 * the `in_progress` entry for Sales screens.
 */
export const CLIENT_STATUS_BADGES: Record<
  ClientStatus,
  { label: string; background: string; color: string }
> = {
  prospect: { label: 'PROSPECT', background: COLORS.blueSoft, color: COLORS.blue },
  in_progress: { label: 'IN PROGRESS', background: COLORS.amberSoft, color: COLORS.orange },
  new: { label: 'NEW', background: COLORS.greenSoft, color: COLORS.ledgeGreen },
  existing: { label: 'EXISTING', background: COLORS.polar, color: COLORS.wolf },
  inactive: { label: 'INACTIVE', background: COLORS.swan, color: COLORS.wolf },
};

/**
 * Sales-role variant of `CLIENT_STATUS_BADGES` (ADR-042 follow-up,
 * 2026-07-28) — Sales' own `in_progress` shade per
 * `Wireframe-Sales-BizLink.html`'s `.b-progress{color:#8A5A06}` (line 84),
 * distinct from Manager's `.b-follow` (`#B4740A`, already the shared map's
 * value). Only `app/(tabs)/**` (Sales) screens should import this instead of
 * `CLIENT_STATUS_BADGES` — Manager/Executive screens keep using the shared
 * map unchanged, since their wireframes' `in_progress` color already matches
 * it.
 */
export const SALES_CLIENT_STATUS_BADGES: Record<
  ClientStatus,
  { label: string; background: string; color: string }
> = {
  ...CLIENT_STATUS_BADGES,
  in_progress: { label: 'IN PROGRESS', background: COLORS.amberSoft, color: '#8A5A06' },
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

/** True once a client's resolved status (via getClientStatus) reaches the photo-only fast path — 'new' or 'existing' (ADR-015). */
export function isFastPathEligible(client: Pick<Client, 'status'>): boolean {
  const status = getClientStatus(client);
  return status === 'new' || status === 'existing';
}

/** True only for 'inactive' — mirrors ADR-006's server-only-lifecycle-automation rule: no other status is ever set by the server alone. */
export function isServerManagedStatus(status: ClientStatus): boolean {
  return status === 'inactive';
}
