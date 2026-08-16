import { Pressable } from 'react-native';
import { router, Tabs } from 'expo-router';
import { Building2, House, Users } from 'lucide-react-native';
import { BIZLINK_COLORS, BIZLINK_FONTS } from '../../lib/theme';
import { ManagerStoreProvider } from '../../lib/manager-store';
import { ManagerScopeProvider } from '../../lib/manager-scope-store';
import { useSession } from '../../lib/session-store';
import { useManagerRequestPopup } from '../../lib/use-manager-request-popup';
import { ManagerRequestPopupBanner } from '../../components/manager/ManagerRequestPopupBanner';

type LucideIcon = typeof House;

/**
 * T-014 Phase 3 (ADR-024): BizLink tab bar for the Manager role group.
 * Matches Sales' tab bar (`app/(tabs)/_layout.tsx`) exactly: plain icon,
 * color change (muted → brand) + size-up on focus, NO background
 * circle/pill behind the icon in any state. (2026-07-17 device-testing
 * feedback: the tint-a circle previously here was removed — Vince tested
 * on-device and wants Manager's tab bar to look identical to Sales'.)
 *
 * B-021: the size-up used to be a CSS `transform: scale()` on a fixed-size
 * icon, which scales the rendered pixels beyond the icon's own layout box
 * without growing that box — clips against the tab button's bounds,
 * especially near the screen edge (leftmost tab). Using a real `size` prop
 * instead grows the SVG's actual layout box, so nothing clips.
 */
function TabIcon({ focused, Icon }: { focused: boolean; Icon: LucideIcon }) {
  return (
    <Icon
      size={focused ? 23 : 21}
      color={focused ? BIZLINK_COLORS.brand : BIZLINK_COLORS.muted}
      strokeWidth={1.75}
    />
  );
}

export default function ManagerTabsLayout() {
  return (
    <ManagerScopeProvider>
      <ManagerStoreProvider>
        <ManagerTabs />
      </ManagerStoreProvider>
    </ManagerScopeProvider>
  );
}

function ManagerTabs() {
  // 2026-08-16 bugfix: `useManagerRequestPopup` (+ its popup UI, now
  // `ManagerRequestPopupBanner` — originally a centered `Modal`, see
  // [[Sprint#2026-08-16]] for the later layout/cadence rework) used to live
  // inside `app/(manager)/index.tsx` (the Home tab screen). This Tabs
  // navigator keeps every visited tab's component tree mounted (once a tab
  // is loaded it stays loaded — see the vendored
  // `react-navigation/bottom-tabs`'s `BottomTabView`'s `loaded` state, which
  // only ever grows) and no `freezeOnBlur`/`enableFreeze()` is configured
  // anywhere in this app, so the popup's `AppState` listener itself was never
  // torn down by switching tabs. The original bug was the `Modal` it
  // rendered: `detachInactiveScreens` (on by default for every platform in
  // this react-native-screens version) detaches an inactive tab's native
  // screen view from the window, and a `Modal` nested inside a detached
  // screen does not present (a documented react-native-screens interaction,
  // not specific to this app) — so a Manager who backgrounded/foregrounded
  // while on Approvals/Tag-Along/any non-Home tab had the popup's state
  // correctly flip to `visible: true` with no visible dialog. Fix: mount the
  // hook and its banner once here, at the layout level (a plain sibling of
  // `<Tabs>`, never inside a `Tabs.Screen`), so it can never be nested inside
  // a detachable screen regardless of which Manager tab is active — this
  // still holds for the banner even though it's no longer a `Modal`.
  const { profileId } = useSession();
  const requestPopup = useManagerRequestPopup(profileId, () => router.push('/(manager)/approvals'));

  return (
    <>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: BIZLINK_COLORS.brand,
          tabBarInactiveTintColor: BIZLINK_COLORS.muted,
          tabBarLabelStyle: { fontSize: 10, fontFamily: BIZLINK_FONTS.semibold },
          // B-021: kills the default Android ripple / iOS dim-on-press behind
          // a tapped tab — see app/(tabs)/_layout.tsx's twin for why this is
          // inline rather than a separately-typed named function.
          tabBarButton: ({ ref: _ref, ...props }) => (
            <Pressable {...props} android_ripple={{ color: 'transparent', borderless: false }} style={props.style} />
          ),
          // Vince direct instruction (2026-08-09): bottom tab bar removed
          // entirely for Manager, no replacement — Home/Team/Clients stay
          // reachable via Home's Quick Actions + in-screen navigation
          // (router.push), same underlying Tabs.Screen routes, just no visible
          // bar. `display: 'none'` (not deleting the screens) keeps every
          // existing `router.push('/(manager)/team')`-style call working.
          tabBarStyle: { display: 'none' },
        }}
      >
        <Tabs.Screen
          name="index"
          options={{ title: 'Home', tabBarIcon: ({ focused }) => <TabIcon focused={focused} Icon={House} /> }}
        />
        <Tabs.Screen
          name="team"
          options={{ title: 'Team', tabBarIcon: ({ focused }) => <TabIcon focused={focused} Icon={Users} /> }}
        />
        <Tabs.Screen
          name="clients"
          options={{
            title: 'Clients',
            tabBarIcon: ({ focused }) => <TabIcon focused={focused} Icon={Building2} />,
          }}
        />
        {/* Batch 6 PR B (ADR-052, F-205 reversal): the Manager Approvals inbox
            re-appears as a hidden route (reachable from Home's Quick Actions
            and dashboard actions) rather than a 4th visible tab —
            Wireframe-Manager-BizLink.html's own 3-button `<nav class="tabbar">`
            markup (~line 857-861) is dead demo markup
            (`.tabbar{display:none!important}`, line 213), never the app's real
            navigation source; the real tab set (Home/Team/Clients) has
            already diverged from it. `tag-along` was retired 2026-08-10 —
            merged into this same route (design-only merge, see
            `lib/manager-request-feed-service.ts`). */}
        <Tabs.Screen name="approvals" options={{ href: null }} />
        <Tabs.Screen name="tag-along-history" options={{ href: null }} />
      </Tabs>

      {/* 2026-08-16 bugfix: see the doc comment above — mounted here, never
          inside a Tabs.Screen, so it's never nested in a detachable screen. */}
      <ManagerRequestPopupBanner
        visible={requestPopup.visible}
        count={requestPopup.newRequestCount}
        onPress={requestPopup.viewRequests}
        onDismiss={requestPopup.dismiss}
      />
    </>
  );
}
