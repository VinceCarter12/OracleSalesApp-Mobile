import { Tabs } from 'expo-router';
import { Ellipsis, House, PencilLine, Users } from 'lucide-react-native';
import { COLORS } from '../../lib/theme';
import { useManagerDashboard } from '../../lib/useManagerDashboard';
import { ManagerStoreProvider, useManagerStore } from '../../lib/manager-store';

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
        tabBarActiveTintColor: COLORS.ledgeGreen,
        tabBarInactiveTintColor: COLORS.hare,
        tabBarStyle: { height: 76, paddingTop: 8, paddingBottom: 18, borderTopColor: COLORS.swan, borderTopWidth: 2 },
        tabBarLabelStyle: { fontSize: 9.5, fontWeight: '800' },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ title: 'Home', tabBarIcon: ({ color, size }) => <House color={color} size={size} /> }}
      />
      <Tabs.Screen
        name="team"
        options={{ title: 'Team', tabBarIcon: ({ color, size }) => <Users color={color} size={size} /> }}
      />
      <Tabs.Screen
        name="approvals"
        options={{
          title: 'Approvals',
          tabBarIcon: ({ color, size }) => <PencilLine color={color} size={size} />,
          tabBarBadge: approvalBadge && approvalBadge > 0 ? approvalBadge : undefined,
          tabBarBadgeStyle: { backgroundColor: COLORS.red, fontSize: 9, fontWeight: '800' },
        }}
      />
      <Tabs.Screen
        name="more"
        options={{ title: 'More', tabBarIcon: ({ color, size }) => <Ellipsis color={color} size={size} /> }}
      />
      <Tabs.Screen name="tag-along" options={{ href: null }} />
    </Tabs>
  );
}
