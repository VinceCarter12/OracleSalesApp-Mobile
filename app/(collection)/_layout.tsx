import { Pressable } from 'react-native';
import { Tabs } from 'expo-router';
import { ClipboardList, House, MoreHorizontal, Vault } from 'lucide-react-native';
import { BIZLINK_COLORS, BIZLINK_FONTS } from '../../lib/theme';

type LucideIcon = typeof House;

/**
 * F-007 first draft (2026-07-25): BizLink tab bar for the Collector role
 * group — Home / Today / Remit / More per the July 3 spec (Meeting-2026-07-03)
 * as rendered in Wireframe-Collection-Delivery-BizLink.html. Bar styling
 * mirrors `app/(manager)/_layout.tsx` exactly (B-021 notes apply here too).
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

export default function CollectionTabsLayout() {
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
        options={{ title: 'Home', tabBarIcon: ({ focused }) => <TabIcon focused={focused} Icon={House} /> }}
      />
      <Tabs.Screen
        name="today"
        options={{ title: 'Today', tabBarIcon: ({ focused }) => <TabIcon focused={focused} Icon={ClipboardList} /> }}
      />
      <Tabs.Screen
        name="remit"
        options={{ title: 'Remit', tabBarIcon: ({ focused }) => <TabIcon focused={focused} Icon={Vault} /> }}
      />
      <Tabs.Screen
        name="more"
        options={{ title: 'More', tabBarIcon: ({ focused }) => <TabIcon focused={focused} Icon={MoreHorizontal} /> }}
      />
    </Tabs>
  );
}
