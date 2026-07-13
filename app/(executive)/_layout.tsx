import { Tabs } from 'expo-router';
import { Building2, Ellipsis, House, Users } from 'lucide-react-native';
import { COLORS } from '../../lib/theme';

/** Wireframe x-tabbar — Home / Teams / Clients / More (Executive, view-only). */
export default function ExecutiveTabsLayout() {
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
        name="teams"
        options={{ title: 'Teams', tabBarIcon: ({ color, size }) => <Users color={color} size={size} /> }}
      />
      <Tabs.Screen
        name="clients"
        options={{ title: 'Clients', tabBarIcon: ({ color, size }) => <Building2 color={color} size={size} /> }}
      />
      <Tabs.Screen
        name="more"
        options={{ title: 'More', tabBarIcon: ({ color, size }) => <Ellipsis color={color} size={size} /> }}
      />
    </Tabs>
  );
}
