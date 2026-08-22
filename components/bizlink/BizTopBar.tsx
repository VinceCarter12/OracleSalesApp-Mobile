import { BackHandler, Pressable } from 'react-native';
import { useCallback, useRef } from 'react';
import { router, useFocusEffect } from 'expo-router';
import type { Href } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';
import { Text, XStack } from 'tamagui';
import { useBizlinkColors, BIZLINK_FONTS } from '../../lib/theme';

interface BizTopBarProps {
  title: string;
  right?: React.ReactNode;
  /**
   * The screen's fixed logical parent (e.g. `/(tabs)` for every former "More"
   * destination — Notifications, Account & Security, Sync History, etc. —
   * now that they hang directly off Home instead of behind a separate More
   * hub screen) — set this for any screen that can be reached by jumping
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
  fallbackHref?: Href;
  /**
   * Use `fallbackHref` only when this screen has no native stack history.
   * This preserves normal nested push/pop behavior while keeping direct
   * route entry recoverable (for example, a meeting screen opened from a
   * notification or deep link).
   */
  fallbackOnlyIfNoHistory?: boolean;
}

/**
 * T-014 Phase 2 (ADR-024): BizLink `.topbar` — white circular back button
 * (44x44dp touch target) + General Sans title. Shared by Sales/RSR and
 * Manager route families; Home/dashboard entry points intentionally omit it.
 */
export function BizTopBar({ title, right, fallbackHref, fallbackOnlyIfNoHistory = false }: BizTopBarProps) {
  const BIZLINK_COLORS = useBizlinkColors();
  const navigationLocked = useRef(false);

  function handleBack(): void {
    // Android can deliver two presses before the native router transition has
    // completed. Ignore the second one so a back tap cannot pop two screens or
    // enqueue duplicate fallback navigations.
    if (navigationLocked.current) return;
    navigationLocked.current = true;

    if (fallbackHref && (!fallbackOnlyIfNoHistory || !router.canGoBack())) {
      router.navigate(fallbackHref);
    } else {
      router.back();
    }

    // Keep the guard short enough that a failed/no-op transition can be retried,
    // while still covering the delayed press events seen on physical Android.
    setTimeout(() => {
      navigationLocked.current = false;
    }, 450);
  }

  // B-118: the Android hardware/gesture back button had no handler anywhere
  // in the app, so it popped the raw expo-router history across tab groups
  // regardless of what this same screen's in-app back button (above) would
  // do — the exact B-019 wrong-tab failure, just reachable a second way.
  // Every screen with a BizTopBar already computes the correct `handleBack`
  // for its own logical parent, so reusing it here (rather than a second,
  // separately-maintained global handler) makes the two paths structurally
  // unable to disagree. Returning `true` marks the event handled, preventing
  // the default OS behavior (pop-or-exit) from also firing.
  //
  // `useFocusEffect`, not a plain `useEffect`: expo-router/React Navigation
  // keep prior stack screens mounted for their exit animation, and
  // BackHandler fires every registered listener in most-recently-added
  // order until one returns `true`. A plain effect would leave a background
  // screen's stale listener registered and able to intercept a press meant
  // for the screen actually on top. Scoping the subscription to focus means
  // at most one BizTopBar's listener is ever live at a time.
  useFocusEffect(
    useCallback(() => {
      const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
        handleBack();
        return true;
      });
      return () => subscription.remove();
      // eslint-disable-next-line react-hooks/exhaustive-deps -- handleBack is
      // a plain function recreated every render, not a stable identity; the
      // only values it actually reads besides module-level `router` and the
      // always-current `navigationLocked` ref are these two props, so listing
      // them (not `handleBack` itself) is the correct, minimal dep list.
    }, [fallbackHref, fallbackOnlyIfNoHistory])
  );

  return (
    <XStack alignItems="center" gap="$2.5" paddingHorizontal="$4" paddingVertical="$2.5">
      <Pressable
        onPress={handleBack}
        hitSlop={6}
        accessibilityRole="button"
        accessibilityLabel={`Back from ${title}`}
        style={({ pressed }) => ({
          width: 44,
          height: 44,
          borderRadius: 22,
          backgroundColor: BIZLINK_COLORS.card,
          alignItems: 'center',
          justifyContent: 'center',
          opacity: pressed ? 0.55 : 1,
        })}
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
