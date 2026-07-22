import { Pressable } from 'react-native';
import { Tabs } from 'expo-router';
import { Building2, House, MoreHorizontal, Users } from 'lucide-react-native';
import { BIZLINK_COLORS, BIZLINK_FONTS } from '../../lib/theme';
import { ManagerStoreProvider } from '../../lib/manager-store';

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
    <ManagerStoreProvider>
      <ManagerTabs />
    </ManagerStoreProvider>
  );
}

function ManagerTabs() {
  return (
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
        tabBarStyle: {
          height: 78,
          paddingTop: 8,
          paddingBottom: 18,
          borderTopWidth: 1,
          borderTopColor: BIZLINK_COLORS.line,
          backgroundColor: BIZLINK_COLORS.card,
        },
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
      <Tabs.Screen
        name="more"
        options={{ title: 'More', tabBarIcon: ({ focused }) => <TabIcon focused={focused} Icon={MoreHorizontal} /> }}
      />
      <Tabs.Screen name="tag-along" options={{ href: null }} />
    </Tabs>
  );
}
