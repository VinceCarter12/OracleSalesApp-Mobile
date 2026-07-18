import { Pressable } from 'react-native';
import { Tabs } from 'expo-router';
import { Building2, Ellipsis, House, Users } from 'lucide-react-native';
import { BIZLINK_COLORS, BIZLINK_FONTS } from '../../lib/theme';

/**
 * T-014 Phase 4 (ADR-024): BizLink tab bar for the Executive role group.
 * Matches Sales'/Manager's tab bar exactly: plain icon, color change
 * (muted → brand) + size-up on focus, NO background circle/pill behind the
 * icon in any state (same 2026-07-17 device-testing direction applied to
 * Manager's tab bar in Phase 3 — `Wireframe-Executive-BizLink.html`'s
 * `.tab.on .tic{background:var(--tint-a)}` line still shows the old circle,
 * unlike the Sales wireframe which had it explicitly removed; per this
 * phase's brief, the established plain-icon direction wins regardless —
 * see handoff report).
 */
export default function ExecutiveTabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: BIZLINK_COLORS.brand,
        tabBarInactiveTintColor: BIZLINK_COLORS.muted,
        tabBarLabelStyle: { fontSize: 10, fontFamily: BIZLINK_FONTS.semibold },
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
        options={{
          title: 'Home',
          tabBarIcon: ({ focused, color }) => <House size={focused ? 23 : 21} color={color} strokeWidth={1.75} />,
        }}
      />
      <Tabs.Screen
        name="teams"
        options={{
          title: 'Teams',
          tabBarIcon: ({ focused, color }) => <Users size={focused ? 23 : 21} color={color} strokeWidth={1.75} />,
        }}
      />
      <Tabs.Screen
        name="clients"
        options={{
          title: 'Clients',
          tabBarIcon: ({ focused, color }) => <Building2 size={focused ? 23 : 21} color={color} strokeWidth={1.75} />,
        }}
      />
      <Tabs.Screen
        name="more"
        options={{
          title: 'More',
          tabBarIcon: ({ focused, color }) => <Ellipsis size={focused ? 23 : 21} color={color} strokeWidth={1.75} />,
        }}
      />
    </Tabs>
  );
}
