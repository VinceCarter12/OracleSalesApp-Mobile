import { Tabs } from 'expo-router';
import { House, MoreHorizontal, PencilLine, Users } from 'lucide-react-native';
import { View } from 'tamagui';
import { BIZLINK_COLORS, BIZLINK_FONTS } from '../../lib/theme';
import { useManagerDashboard } from '../../lib/useManagerDashboard';
import { ManagerStoreProvider, useManagerStore } from '../../lib/manager-store';

type LucideIcon = typeof House;

/**
 * T-014 Phase 3 (ADR-024): BizLink tab bar for the Manager role group.
 * Matches the same fixed-full-width-labeled-tabs CSS the Sales Agent tab bar
 * (`app/(tabs)/_layout.tsx`) already settled on per the wireframe's current,
 * newest-wins CSS (ADR-010) — NOT the older floating-pill brief. One real
 * difference from Sales, confirmed against `Wireframe-Manager-BizLink.html`'s
 * live `.tab.on .tic{background:var(--tint-a)}` rule: Manager's active tab
 * keeps a soft tint-a circle behind the icon (Sales's own wireframe dropped
 * this circle per its 2026-07-16 client feedback comment) — implemented here
 * via `TabIcon`'s tinted circle wrapper.
 */
function TabIcon({ focused, Icon }: { focused: boolean; Icon: LucideIcon }) {
  return (
    <View
      width={40}
      height={28}
      borderRadius={14}
      alignItems="center"
      justifyContent="center"
      backgroundColor={focused ? BIZLINK_COLORS.tintA : 'transparent'}
    >
      <Icon
        size={21}
        color={focused ? BIZLINK_COLORS.brand : BIZLINK_COLORS.muted}
        strokeWidth={1.75}
        style={{ transform: [{ scale: focused ? 1.12 : 1 }] }}
      />
    </View>
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
  const { summary } = useManagerDashboard();
  const { approvals } = useManagerStore();
  const approvalBadge = approvals.length || summary?.pendingApprovals;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: BIZLINK_COLORS.brand,
        tabBarInactiveTintColor: BIZLINK_COLORS.muted,
        tabBarLabelStyle: { fontSize: 10, fontFamily: BIZLINK_FONTS.semibold },
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
        name="approvals"
        options={{
          title: 'Approvals',
          tabBarIcon: ({ focused }) => <TabIcon focused={focused} Icon={PencilLine} />,
          tabBarBadge: approvalBadge && approvalBadge > 0 ? approvalBadge : undefined,
          tabBarBadgeStyle: { backgroundColor: BIZLINK_COLORS.red, fontSize: 9, fontFamily: BIZLINK_FONTS.semibold },
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
