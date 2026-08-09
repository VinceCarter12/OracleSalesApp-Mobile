import type { Href } from 'expo-router';
import type { UserRole } from '../types';

// Batch 7a (2026-08-02): a single typed lookup for every dashboard/quick-action
// entry point across Sales/RSR ((tabs)), Manager ((manager)), and Executive
// ((executive)) home screens. Before this, each screen had its own ad-hoc
// `router.push('/some/literal/path')` calls with no compile-time link between
// "which roles see this button" and "where does it go" — this registry makes
// that pairing explicit and checkable (acceptance: "each visible action has
// one authorized destination"). Deliberately scoped to dashboard quick-action
// buttons only, not a sweeping rewrite of every navigation call in the app —
// see Batch 7a scope note.
//
// Deep, param-carrying navigation (client detail, meeting detail, record-meeting
// for a specific client, etc.) already has its own typed builder,
// `lib/use-role-routes.ts`'s `useClientFlowRoutes()` — this registry does not
// duplicate that, it only covers the static top-level destinations dashboard
// quick-action tiles point to.

export type DashboardActionId =
  | 'create-client'
  | 'record-meeting'
  | 'my-clients'
  | 'manager-approvals'
  | 'manager-tag-along'
  | 'manager-sales-history'
  | 'manager-clients'
  | 'manager-more'
  | 'manager-team'
  | 'manager-create-client'
  | 'manager-record-meeting'
  | 'executive-teams'
  | 'executive-clients'
  | 'executive-maps'
  | 'executive-reports';

interface DashboardActionDef {
  href: Href;
  /** Roles authorized to see/trigger this action. */
  roles: readonly UserRole[];
}

const DASHBOARD_ACTIONS: Record<DashboardActionId, DashboardActionDef> = {
  'create-client': { href: '/(tabs)/clients/create' as Href, roles: ['sales_specialist', 'rsr'] },
  'record-meeting': { href: '/(tabs)/meetings/select-client' as Href, roles: ['sales_specialist', 'rsr'] },
  'my-clients': { href: '/(tabs)/clients' as Href, roles: ['sales_specialist', 'rsr'] },

  'manager-approvals': { href: '/(manager)/approvals' as Href, roles: ['sales_manager'] },
  'manager-tag-along': { href: '/(manager)/tag-along' as Href, roles: ['sales_manager'] },
  'manager-sales-history': { href: '/(manager)/more/meetings' as Href, roles: ['sales_manager'] },
  'manager-clients': { href: '/(manager)/more/clients' as Href, roles: ['sales_manager'] },
  'manager-more': { href: '/(manager)/more' as Href, roles: ['sales_manager'] },
  'manager-team': { href: '/(manager)/team' as Href, roles: ['sales_manager'] },
  // Wireframe-Manager-BizLink.html s-home "Mga Gawain" (startManagerCreateClient/
  // startManagerRecordMeeting): the manager's own client/record flow lives under
  // `(manager)/clients` (F-205 reuse of the Sales screens, see
  // lib/use-role-routes.ts), distinct from the team-wide `(manager)/more/clients`.
  // There is no dedicated "select client" screen for Manager (unlike Sales'
  // meetings/select-client) — the manager's own client list is the equivalent
  // "pick a client first" destination for starting a meeting.
  'manager-create-client': { href: '/(manager)/clients/create' as Href, roles: ['sales_manager'] },
  'manager-record-meeting': { href: '/(manager)/clients' as Href, roles: ['sales_manager'] },

  'executive-teams': { href: '/(executive)/teams' as Href, roles: ['executive'] },
  'executive-clients': { href: '/(executive)/clients' as Href, roles: ['executive'] },
  'executive-maps': { href: '/(executive)/more/maps' as Href, roles: ['executive'] },
  'executive-reports': { href: '/(executive)/more/reports' as Href, roles: ['executive'] },
};

/**
 * Throws if `role` is not authorized for `id` — a misused registry entry
 * should fail loudly in dev, not silently navigate somewhere the role
 * shouldn't reach. Accepts `null` because `useSession()`'s `role` is
 * nullable before the session snapshot loads; a dashboard quick action can't
 * legitimately be tapped before that point (the screen itself gates on
 * session readiness), so `null` is always unauthorized here.
 */
export function getDashboardActionHref(id: DashboardActionId, role: UserRole | null): Href {
  const def = DASHBOARD_ACTIONS[id];
  if (!role || !def.roles.includes(role)) {
    throw new Error(`[dashboard-action-registry] "${id}" is not authorized for role "${role}"`);
  }
  return def.href;
}

export function isDashboardActionAllowed(id: DashboardActionId, role: UserRole | null): boolean {
  return role !== null && DASHBOARD_ACTIONS[id].roles.includes(role);
}
