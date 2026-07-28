import { Stack } from 'expo-router';

/**
 * F-007 (2026-07-25): Collector role group. Per
 * Wireframe-Collection-Delivery-BizLink.html the Collection flow is
 * DASHBOARD-FIRST with NO bottom nav bar — every destination (Today's List,
 * Collect, Remit, History, Account) is reached from the Home hub's Actions
 * grid and pushed onto this stack. Sub-screens carry their own BizTopBar back
 * button. (Replaces the earlier Tabs layout — the wireframe explicitly has no
 * tab bar for this role.)
 */
export default function CollectionStackLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
