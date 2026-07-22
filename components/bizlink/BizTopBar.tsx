import { Pressable } from 'react-native';
import { router } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';
import { Text, XStack } from 'tamagui';
import { useBizlinkColors, BIZLINK_FONTS } from '../../lib/theme';

interface BizTopBarProps {
  title: string;
  right?: React.ReactNode;
  /**
   * The screen's fixed logical parent (e.g. `/(tabs)/more` for every More
   * sub-screen) — set this for any screen that can be reached by jumping
   * straight into a nested tab route from a DIFFERENT tab (e.g. Home's
   * avatar/bell pushing directly into `/more/account` or
   * `/more/notifications`). When set, back ALWAYS navigates here rather than
   * calling `router.back()` — `canGoBack()` is true in this scenario (there's
   * always somewhere to pop to, namely the tab the jump originated from), so
   * a `canGoBack()`-conditional fallback never actually engages; it silently
   * pops to the wrong tab instead of this screen's real parent (B-019).
   * Omit for screens only ever reached by an in-stack push from their own
   * logical parent (the common case) — `router.back()` alone is correct
   * there, since it already lands on the same place `fallbackHref` would.
   */
  fallbackHref?: string;
}

/**
 * T-014 Phase 2 (ADR-024): BizLink `.topbar` — white circular back button
 * (44x44dp touch target) + General Sans title. Scoped to `app/(tabs)` for
 * this phase — see `components/ui/TopBar.tsx` for the Manager/Executive
 * equivalent (out of scope, unchanged).
 */
export function BizTopBar({ title, right, fallbackHref }: BizTopBarProps) {
  const BIZLINK_COLORS = useBizlinkColors();
  function handleBack(): void {
    if (fallbackHref) {
      router.navigate(fallbackHref as never);
    } else {
      router.back();
    }
  }

  return (
    <XStack alignItems="center" gap="$2.5" paddingHorizontal="$4" paddingVertical="$2.5">
      <Pressable
        onPress={handleBack}
        hitSlop={6}
        style={{
          width: 44,
          height: 44,
          borderRadius: 22,
          backgroundColor: BIZLINK_COLORS.card,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <ArrowLeft size={18} color={BIZLINK_COLORS.text} strokeWidth={1.75} />
      </Pressable>
      <Text fontSize={19} fontFamily={BIZLINK_FONTS.semibold} color={BIZLINK_COLORS.text}>
        {title}
      </Text>
      {right ? <XStack marginLeft="auto">{right}</XStack> : null}
    </XStack>
  );
}
