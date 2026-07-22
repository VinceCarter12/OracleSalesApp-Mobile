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
  recordMeeting: (clientId: string) => Href;
  meetingDetail: (id: string) => Href;
  celebrate: (online: boolean) => Href;
  home: () => Href;
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
    recordMeeting: (clientId: string) => `${meetingsBase}/record?clientId=${clientId}` as Href,
    meetingDetail: (id: string) => (isManager ? `${meetingsBase}/meeting/${id}` : `${meetingsBase}/${id}`) as Href,
    celebrate: (online: boolean) => `${meetingsBase}/celebrate?online=${online}` as Href,
    home: () => homeBase as Href,
  };
}
