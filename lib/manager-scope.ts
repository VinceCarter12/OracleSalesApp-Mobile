/**
 * Batch 6 PR C (ADR-052 §G, closes B-073): a single global manager record
 * scope, matching Wireframe-Manager-BizLink.html's `managerScope` variable
 * (line ~982) exactly — one shared type, not four independent per-screen
 * states. `lib/manager-dashboard-service.ts` (previously always excluded the
 * manager from team aggregates) and `lib/manager-team-service.ts::fetchTeamOverview()`
 * (previously always included the manager) disagreed on this exact question —
 * this type plus `partitionByScope` (`lib/team-remote-mappers.ts`) is the one
 * shared answer both now use.
 */
export type ManagerScope = 'mine' | 'team' | 'combined';

/**
 * Sprint.md "Scope Filter Decisions Confirmed (2026-08-02)": default scope on
 * fresh load is 'combined' — NOT 'mine'. This also happens to match
 * `lib/manager-team-service.ts::fetchTeamOverview()`'s pre-existing
 * always-include-manager behavior, so every screen that doesn't opt into an
 * explicit scope selection (Manager Clients, Manager Map, Manager Team,
 * Reports, Account, etc. — none of which are in PR C's scope) keeps its
 * current numbers unchanged.
 */
export const DEFAULT_MANAGER_SCOPE: ManagerScope = 'combined';

/**
 * Shared row-partitioning by manager scope — the one derivation both
 * `lib/manager-dashboard-service.ts` (previously always excluded the
 * manager) and `lib/manager-team-service.ts::fetchTeamOverview()`
 * (previously always included the manager) now use, so their `'mine'`/
 * `'team'`/`'combined'` numbers finally agree (closes B-073). Mirrors
 * Wireframe-Manager-BizLink.html's `renderMeetingsFull()` filter predicate
 * exactly: `managerScope==='combined'||(managerScope==='mine'?c.managerOwned:!c.managerOwned)`.
 *
 * ADR-052 §G names `lib/team-remote-mappers.ts` as the preferred home for
 * this helper, but that file is already at 279/300 lines (coding-standard
 * cap) — adding this pushed it to 314, so it lives here instead, in the type
 * definition's own file, per ADR-052 §G's explicit fallback.
 *
 * Generic over the row shape (`ClientRow`/`MeetingRow` in
 * `lib/team-remote-mappers.ts` use `assigned_agent_id`/`agent_id`, not a
 * common `agentId` field) — callers pass their own accessor rather than this
 * function reshaping rows to fit one signature.
 */
export function partitionByScope<T>(
  rows: readonly T[],
  agentIdOf: (row: T) => string,
  managerProfileId: string,
  scope: ManagerScope
): readonly T[] {
  switch (scope) {
    case 'mine':
      return rows.filter((row) => agentIdOf(row) === managerProfileId);
    case 'team':
      return rows.filter((row) => agentIdOf(row) !== managerProfileId);
    case 'combined':
    default:
      return rows;
  }
}
