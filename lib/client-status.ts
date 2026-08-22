import { COLORS } from './theme';
import type { Client, ClientStatus, Meeting } from '../types';

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

/**
 * Vince 2026-08-04 direction: an OVERLAY badge (like the one above), driven
 * by a same-day `meeting_drafts` row (lib/meeting-drafts.ts) for this
 * client — reuses the same green tint as the wireframe's own in-screen
 * "Meeting in progress" banner (`--green-tint`/ink), not a new color.
 */
export const MEETING_IN_PROGRESS_BADGE = {
  label: 'Meeting in progress',
  background: 'tintA' as const,
  color: 'ink' as const,
};

/**
 * Vince 2026-08-04 direction (Tagalog): "kung in progress na tapos success
 * meeting at nakapag submit ng PO is ang ilalagay is waiting for managers
 * approval" — an OVERLAY badge (same pattern as the two above), distinct
 * from `WAITING_MANAGER_APPROVAL_BADGE` above since that one is the
 * prospect→new tag-along-approval domain (Migration 023) while this one is
 * the separate in_progress PO-confirmation domain (ADR-044/Migration 039,
 * `lib/po-confirmation-service.ts`/`lib/policies/po-confirmation-status-
 * policy.ts`'s `'pending'` display status). Reuses the same amber/orange
 * tokens as `WAITING_MANAGER_APPROVAL_BADGE` since both are literally "an
 * agent action is waiting on a Manager decision," just named distinctly so
 * the two can never be confused at a call site.
 */
export const WAITING_MANAGER_PO_APPROVAL_BADGE = {
  label: "Waiting for Manager's Approval",
  background: 'amberSoft' as const,
  color: 'orange' as const,
};

/**
 * ADR-061 (Vince, 2026-08-19/20): the `prospect`-stage counterpart of
 * `WAITING_MANAGER_PO_APPROVAL_BADGE` above, for Scenario 1 (a prospect
 * submitting PO evidence directly, bypassing `in_progress`). Same amber/
 * orange "waiting on a Manager decision" family as the badge it mirrors —
 * deliberately not a new color, so the visual language for "something needs
 * the Manager" stays consistent app-wide — but the label makes explicit
 * that the client's STATUS itself has not moved (it stays PROSPECT while
 * this is pending; see ADR-061 decision 3), which the in_progress version
 * doesn't need to say since that badge never contradicts the status pill
 * sitting next to it.
 */
export const WAITING_MANAGER_PO_APPROVAL_PROSPECT_BADGE = {
  label: "Prospect · Awaiting Manager's Approval",
  background: 'amberSoft' as const,
  color: 'orange' as const,
};

/**
 * ADR-061: the warning copy shown alongside `WAITING_MANAGER_PO_APPROVAL_PROSPECT_BADGE`
 * on Client Detail and Meeting Detail (not the compact My Clients list card,
 * which has no room for a second line) — Vince's "may warning message"
 * instruction. Explains in plain language why the client hasn't visibly
 * advanced yet, since PROSPECT + a submitted PO otherwise reads as "nothing
 * happened."
 */
export const PROSPECT_PO_PENDING_WARNING =
  'This client stays Prospect while the purchase order is pending. It moves to New only after your manager approves it.';

/** True once a client's resolved status (via getClientStatus) reaches the photo-only fast path — 'new' or 'existing' (ADR-015). */
export function isFastPathEligible(client: Pick<Client, 'status'>): boolean {
  const status = getClientStatus(client);
  return status === 'new' || status === 'existing';
}

/** True only for 'inactive' — mirrors ADR-006's server-only-lifecycle-automation rule: no other status is ever set by the server alone. */
export function isServerManagedStatus(status: ClientStatus): boolean {
  return status === 'inactive';
}

/**
 * B-095 fix (2026-08-08): the per-MEETING lifecycle badge on a meeting list
 * card (My Meetings, Manager Meetings) must show the client's status AT THE
 * TIME that meeting happened, never the client's live/current status —
 * otherwise every card for the same client shows the same, constantly
 * mutating badge. `null` means either a legacy meeting recorded before
 * Migration v26 or a meeting with no client_id — callers must render no
 * badge in that case rather than falling back to `getClientStatus()`.
 * Deliberately does NOT apply to the single Meeting Detail page
 * (`app/(tabs)/meetings/[id].tsx`), which keeps live `getClientStatus()` for
 * its dual-purpose display + PO-approval gating check.
 */
export function getMeetingLifecycleStatus(
  meeting: Pick<Meeting, 'client_status_at_meeting'>
): ClientStatus | null {
  return meeting.client_status_at_meeting ?? null;
}
