import { Stack } from 'expo-router';

/**
 * F-007 (2026-07-25): Delivery (driver) role group. Per
 * Wireframe-Collection-Delivery-BizLink.html the Delivery flow is
 * DASHBOARD-FIRST with NO bottom nav bar — every destination (PO List,
 * Deliver, Remit, History, Account) is reached from the Home hub's Actions
 * grid and pushed onto this stack. Sub-screens carry their own BizTopBar back
 * button. The whole module is still DRAFT pending spec (OQ-5) — see
 * Meeting-2026-07-25. (Replaces the earlier Tabs layout.)
 */
export default function DeliveryStackLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
