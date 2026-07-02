import { Tabs } from 'expo-router';

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: '#003087',
        headerShown: true,
      }}
    >
      <Tabs.Screen
        name="clients"
        options={{
          title: 'Clients',
          headerTitle: 'Clients',
        }}
      />
      <Tabs.Screen
        name="meetings"
        options={{
          title: 'Meetings',
          headerTitle: 'Meetings',
        }}
      />
    </Tabs>
  );
}
