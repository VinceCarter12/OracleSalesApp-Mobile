import { useSegments } from 'expo-router';
import type { Href } from 'expo-router';

// F-205: the Sales client/meeting flow screens (app/(tabs)/clients/*,
// app/(tabs)/meetings/*) are reused byte-for-byte under the new
// `app/(manager)/clients/*` route group (re-exported, not duplicated — see
// that folder's `_layout.tsx`). Those screens have a handful of hardcoded
// `/(tabs)/...` hrefs baked in, which would silently send a manager back
// into the Sales tab group mid-flow. This hook is the single place that
// resolves "which route group is this screen currently rendered under" via
// `useSegments()` and returns typed builders — screens call these instead
// of hardcoding a prefix, so the same screen body is correct in both places.
//
// `as Href` is used because the two possible prefixes are only known at
// render time (not statically at the call site), so expo-router's typed
// routes can't narrow the template literal on its own — same escape hatch
// already established in `components/bizlink/BizTopBar.tsx`'s
// `fallbackHref` handling, just typed against `Href` instead of `never` for
// a slightly stronger guarantee (the string still has to be a real route).

type RouteGroup = '(tabs)' | '(manager)';

export interface ClientFlowRoutes {
  clientDetail: (id: string) => Href;
  createClient: () => Href;
  completeInfo: (clientId: string) => Href;
  /** Batch 4 (2026-07-29): Client Detail's Set/Update Office Location button — GPS-capture-only screen, see [[Office-Location-Spec-2026-07-29]]. */
  officeLocation: (clientId: string) => Href;
  /**
   * Meeting Detail's "Client journey & activities" preview card (2026-08-04
   * handoff) — read-only history screen, mirrors the wireframe's
   * `aOpenClientJourney(clientId, from)`. `from` is an optional already-built
   * `Href` string (e.g. `String(routes.meetingDetail(id))`) used as the
   * journey screen's `BizTopBar` back fallback for the rare case it's reached
   * outside a normal in-stack push. `(tabs)`-only today — no
   * `app/(manager)/clients/journey.tsx` re-export exists yet. Unlike
   * `recordVisit` (not yet wired into any Manager call site), this one IS
   * live-reachable from Manager today via the shared
   * `app/(tabs)/meetings/[id].tsx` (re-exported at
   * `app/(manager)/clients/meeting/[id].tsx`) — that screen gates its own
   * journey-preview card on `!isManager` for exactly this reason. Any new
   * caller under `(manager)` must do the same until the re-export exists.
   */
  clientJourney: (clientId: string, from?: string) => Href;
  recordMeeting: (clientId: string) => Href;
  /**
   * Fast-path record (New/Existing) — mirrors `recordMeeting`'s URL-building
   * pattern, but unlike `recordMeeting`, this one is `(tabs)`-only today:
   * there is no `app/(manager)/clients/record-visit.tsx` re-export yet.
   * Add that file (mirroring `app/(manager)/clients/record.tsx`) before
   * wiring any Manager entry point through `isFastPathEligible()`, or this
   * will resolve to a real `Href` that 404s at runtime for Manager.
   */
  recordVisit: (clientId: string) => Href;
  meetingDetail: (id: string) => Href;
  celebrate: (online: boolean, meetingId?: string, clientId?: string) => Href;
  meetingsHome: () => Href;
  clientList: () => Href;
  home: () => Href;
  /**
   * True when this screen is currently mounted under `(manager)`. Exposed so
   * a shared `(tabs)`/`(manager)`-reused screen can hide UI that links to a
   * route only added under `(tabs)` so far (e.g. `clientJourney`/`recordVisit`
   * — see their own doc comments) instead of building a `Href` that 404s.
   */
  isManager: boolean;
}

export function useClientFlowRoutes(): ClientFlowRoutes {
  const segments = useSegments();
  const group: RouteGroup = segments[0] === '(manager)' ? '(manager)' : '(tabs)';
  const isManager = group === '(manager)';

  // Manager's client detail/create/complete screens live under
  // `(manager)/clients`; meetings are nested there too (record, celebrate,
  // meeting/[id]) since the Manager route group has no separate `meetings`
  // tab — mirrors the `app/(executive)/clients/meeting/[id].tsx` nesting
  // precedent.
  const clientsBase = isManager ? '/(manager)/clients' : '/(tabs)/clients';
  const meetingsBase = isManager ? '/(manager)/clients' : '/(tabs)/meetings';
  const homeBase = isManager ? '/(manager)' : '/(tabs)';

  return {
    clientDetail: (id: string) => `${clientsBase}/${id}` as Href,
    createClient: () => `${clientsBase}/create` as Href,
    completeInfo: (clientId: string) => `${clientsBase}/complete?clientId=${clientId}` as Href,
    officeLocation: (clientId: string) => `${clientsBase}/office-location?clientId=${clientId}` as Href,
    clientJourney: (clientId: string, from?: string) =>
      `${clientsBase}/journey?clientId=${clientId}${from ? `&from=${encodeURIComponent(from)}` : ''}` as Href,
    recordMeeting: (clientId: string) => `${meetingsBase}/record?clientId=${clientId}` as Href,
    recordVisit: (clientId: string) => `${meetingsBase}/record-visit?clientId=${clientId}` as Href,
    meetingDetail: (id: string) => (isManager ? `${meetingsBase}/meeting/${id}` : `${meetingsBase}/${id}`) as Href,
    // Batch 7C (ADR-053): optional `clientId` param feeds the celebrate
    // screen's PostRecordCutoffStatus (W-3) — additive, existing 2-arg
    // callers are unaffected.
    celebrate: (online: boolean, meetingId?: string, clientId?: string) =>
      `${meetingsBase}/celebrate?online=${online}${meetingId ? `&meetingId=${encodeURIComponent(meetingId)}` : ''}${clientId ? `&clientId=${encodeURIComponent(clientId)}` : ''}` as Href,
    meetingsHome: () => (isManager ? '/(manager)/more/meetings' : '/(tabs)/meetings') as Href,
    clientList: () => clientsBase as Href,
    home: () => homeBase as Href,
    isManager,
  };
}
