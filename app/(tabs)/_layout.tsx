import { Tabs } from 'expo-router';

/**
 * Wireframe-Sales-BizLink.html line 415 (sidebar spec text): "Dashboard-first
 * Sales flow · no bottom navigation." Vince confirmed 2026-08-03 to follow
 * this literal line over the wireframe's own `.tabbar` CSS (which has a
 * dated 2026-07-14 client-feedback comment implying a real fixed bottom
 * nav existed at some point) — the CSS is flagged as a known contradiction,
 * not silently discarded, but the explicit product decision is "no bottom
 * navigation" per this pass. `tabBarStyle: { display: 'none' }` removes both
 * the visible bar and the layout's reserved bottom inset/safe-area padding
 * for it, while keeping the four screens reachable via their real routes
 * (the Dashboard Hub's "Mga Gawain"/"Iba pang gawain" tiles already cover
 * every one of these destinations — see app/(tabs)/index.tsx).
 *
 * Known gap (flagged for Vince, not silently patched): screens other than
 * Home have no on-screen way back to Home now except the device back
 * button/gesture, since no wireframe-authorized in-screen "home" control
 * exists to invent one. Each screen's own BizTopBar back arrow still returns
 * to its immediate previous screen, not necessarily Home.
 */
export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: { display: 'none' },
      }}
    >
      <Tabs.Screen name="index" />
      <Tabs.Screen name="clients" />
      <Tabs.Screen name="meetings" />
      <Tabs.Screen name="more" />
    </Tabs>
  );
}
