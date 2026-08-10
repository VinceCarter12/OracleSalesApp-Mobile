import { Stack } from 'expo-router';

/**
 * Executive role navigation: a plain Stack, NO bottom tab bar (2026-08-10,
 * owner request). The Executive dashboard (`index`) is the single hub — every
 * destination (Teams, Clients, Reports, Maps, Lost Opportunity, Tag-Along Log,
 * Account) is reached from its Quick Actions grid and pushed onto this stack,
 * each landing screen carrying its own `BizTopBar` back button. Replaces the
 * former 4-tab bar (Home / Teams / Clients / More); the "More" hub screen is
 * now unused (its items are surfaced directly as Quick Actions).
 */
export default function ExecutiveLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
