import { Tabs } from 'expo-router';
import { Building2, Handshake, House, MoreHorizontal } from 'lucide-react-native';
import { View } from 'tamagui';
import { COLORS } from '../../lib/theme';

function TabIcon({
  focused,
  children,
}: {
  focused: boolean;
  children: React.ReactNode;
}) {
  return (
    <View
      paddingHorizontal={14}
      paddingVertical={3}
      borderRadius={999}
      backgroundColor={focused ? COLORS.greenTint : 'transparent'}
    >
      {children}
    </View>
  );
}

/** Wireframe a-tabbar: Home / Clients / Meetings / More with green-tint active pill. */
export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: COLORS.ledgeGreen,
        tabBarInactiveTintColor: COLORS.hare,
        tabBarLabelStyle: { fontSize: 9.5, fontWeight: '800' },
        tabBarStyle: {
          height: 76,
          paddingTop: 8,
          paddingBottom: 18,
          borderTopWidth: 2,
          borderTopColor: COLORS.swan,
          backgroundColor: COLORS.snow,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ focused, color }) => (
            <TabIcon focused={focused}>
              <House size={20} color={color} />
            </TabIcon>
          ),
        }}
      />
      <Tabs.Screen
        name="clients"
        options={{
          title: 'Clients',
          tabBarIcon: ({ focused, color }) => (
            <TabIcon focused={focused}>
              <Building2 size={20} color={color} />
            </TabIcon>
          ),
        }}
      />
      <Tabs.Screen
        name="meetings"
        options={{
          title: 'Meetings',
          tabBarIcon: ({ focused, color }) => (
            <TabIcon focused={focused}>
              <Handshake size={20} color={color} />
            </TabIcon>
          ),
        }}
      />
      <Tabs.Screen
        name="more"
        options={{
          title: 'More',
          tabBarIcon: ({ focused, color }) => (
            <TabIcon focused={focused}>
              <MoreHorizontal size={20} color={color} />
            </TabIcon>
          ),
        }}
      />
    </Tabs>
  );
}
