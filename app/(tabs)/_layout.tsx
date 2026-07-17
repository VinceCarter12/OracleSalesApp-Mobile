import { Tabs } from 'expo-router';
import { Building2, Handshake, House, MoreHorizontal } from 'lucide-react-native';
import { BIZLINK_COLORS, BIZLINK_FONTS } from '../../lib/theme';

/**
 * T-014 Phase 2 (ADR-024): BizLink tab bar.
 *
 * NOTE (flagged, not silently deviated): the task brief describing this
 * phase said to build a "floating detached pill nav ... active tab = light
 * circle hole, no labels", matching an older description in
 * Design-System-Catalog.md §3. But `Wireframe-Sales-BizLink.html`'s actual
 * `.tabbar`/`.tab` CSS (the ADR-010 source of record, most recently edited)
 * shows a DIFFERENT, revised design: a bottom nav fixed flush to the phone's
 * bottom edge (not floating/detached), WITH labels, white card background,
 * and an active state that's just brand-green color + icon scale (no pill/
 * circle backdrop) — per two dated client-feedback comments embedded in the
 * wireframe's CSS itself ("2026-07-14 — wag na floating"; "2026-07-16 —
 * mas malinis without the highlight circle"). The wireframe's live CSS is
 * newer than the catalog's floating-nav description and wins per ADR-010.
 * This implementation matches the wireframe's ACTUAL current CSS, not the
 * older floating-pill brief — see the mobile-engineer handoff report for
 * this pass.
 */
export default function TabsLayout() {
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
        options={{
          title: 'Home',
          tabBarIcon: ({ focused, color }) => <House size={21} color={color} strokeWidth={1.75} style={{ transform: [{ scale: focused ? 1.12 : 1 }] }} />,
        }}
      />
      <Tabs.Screen
        name="clients"
        options={{
          title: 'Clients',
          tabBarIcon: ({ focused, color }) => <Building2 size={21} color={color} strokeWidth={1.75} style={{ transform: [{ scale: focused ? 1.12 : 1 }] }} />,
        }}
      />
      <Tabs.Screen
        name="meetings"
        options={{
          title: 'Meetings',
          tabBarIcon: ({ focused, color }) => <Handshake size={21} color={color} strokeWidth={1.75} style={{ transform: [{ scale: focused ? 1.12 : 1 }] }} />,
        }}
      />
      <Tabs.Screen
        name="more"
        options={{
          title: 'More',
          tabBarIcon: ({ focused, color }) => <MoreHorizontal size={21} color={color} strokeWidth={1.75} style={{ transform: [{ scale: focused ? 1.12 : 1 }] }} />,
        }}
      />
    </Tabs>
  );
}
