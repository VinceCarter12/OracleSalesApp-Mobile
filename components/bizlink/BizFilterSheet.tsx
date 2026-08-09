import { type ReactNode, useEffect, useState } from 'react';
import { Animated, Modal, Pressable, ScrollView, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { X } from 'lucide-react-native';
import { Text, XStack, YStack } from 'tamagui';
import { useBizlinkColors, BIZLINK_FONTS } from '../../lib/theme';

interface BizFilterSheetProps {
  visible: boolean;
  onClose: () => void;
  /** Whether any non-default filter is currently applied — gates the Reset action. */
  filtersActive: boolean;
  onReset: () => void;
  children: ReactNode;
}

/** Off-screen starting offset for the slide-up entrance/exit — only needs to
 * clear the sheet's tallest realistic content, exact value doesn't matter
 * since the transform target is always 0. */
const SHEET_OFFSCREEN_Y = 420;
const ANIM_DURATION_IN = 240;
const ANIM_DURATION_OUT = 200;

/**
 * Design-only filter-UI redesign (Vince-approved, .claude/rules/
 * 50-wireframe-redesign.md): shared bottom-sheet shell for the Sales tabs'
 * "Filters" toggle. Same RN Modal + Pressable-backdrop + rounded-top-sheet
 * pattern as components/sync/SyncCenterSheet.tsx — deliberately NOT Tamagui
 * `Sheet`. Filters already apply live as chips are tapped (no separate
 * "Apply" step existed before this change), so this shell has no Apply
 * button — closing the sheet is enough.
 *
 * `Modal`'s `visible` is bound directly to the `visible` prop (no local
 * "is the modal mounted" state) so the sheet reliably shows/hides regardless
 * of animation timing. Backdrop and sheet still animate independently
 * (Vince, 2026-08-08): the backdrop fades in/out while the sheet slides
 * up/down, instead of both moving together as one Modal-driven slide (which
 * made the dim overlay visibly "slide up" with the card). The dismiss paths
 * (backdrop tap, X button, Android back) run a short close animation before
 * calling `onClose`, entirely inside event handlers — no `setState` inside
 * an effect (react-hooks/set-state-in-effect stays clean).
 */
export function BizFilterSheet({ visible, onClose, filtersActive, onReset, children }: BizFilterSheetProps) {
  const BIZLINK_COLORS = useBizlinkColors();
  const insets = useSafeAreaInsets();
  const [overlayOpacity] = useState(() => new Animated.Value(0));
  const [sheetTranslateY] = useState(() => new Animated.Value(SHEET_OFFSCREEN_Y));

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(overlayOpacity, { toValue: 1, duration: ANIM_DURATION_IN, useNativeDriver: true }),
        Animated.timing(sheetTranslateY, { toValue: 0, duration: ANIM_DURATION_IN, useNativeDriver: true }),
      ]).start();
    }
  }, [visible, overlayOpacity, sheetTranslateY]);

  function handleDismiss(): void {
    Animated.parallel([
      Animated.timing(overlayOpacity, { toValue: 0, duration: ANIM_DURATION_OUT, useNativeDriver: true }),
      Animated.timing(sheetTranslateY, { toValue: SHEET_OFFSCREEN_Y, duration: ANIM_DURATION_OUT, useNativeDriver: true }),
    ]).start(({ finished }) => {
      if (finished) onClose();
    });
  }

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={handleDismiss}>
      <Pressable onPress={handleDismiss} style={{ flex: 1, justifyContent: 'flex-end' }}>
        <Animated.View
          pointerEvents="none"
          style={[StyleSheet.absoluteFill, { backgroundColor: '#000', opacity: overlayOpacity.interpolate({ inputRange: [0, 1], outputRange: [0, 0.4] }) }]}
        />
        <Animated.View style={{ width: '100%', height: '78%', transform: [{ translateY: sheetTranslateY }] }}>
          <Pressable onPress={(e) => e.stopPropagation()} style={{ flex: 1 }}>
            <YStack
              flex={1}
              backgroundColor={BIZLINK_COLORS.canvas}
              borderTopLeftRadius={28}
              borderTopRightRadius={28}
              paddingBottom={insets.bottom + 18}
            >
              <XStack justifyContent="center" paddingTop={10}>
                <YStack width={40} height={4} borderRadius={2} backgroundColor={BIZLINK_COLORS.line} />
              </XStack>

              <XStack alignItems="center" justifyContent="space-between" paddingHorizontal={18} paddingTop={12} paddingBottom={4}>
                <Pressable
                  accessibilityLabel="Close filters"
                  onPress={handleDismiss}
                  hitSlop={8}
                  style={{ minWidth: 44, minHeight: 44, alignItems: 'flex-start', justifyContent: 'center' }}
                >
                  <X size={18} color={BIZLINK_COLORS.text} strokeWidth={1.75} />
                </Pressable>
                <Text fontSize={15} fontFamily={BIZLINK_FONTS.semibold} color={BIZLINK_COLORS.text}>
                  Filters
                </Text>
                <Pressable
                  accessibilityLabel="Reset filters"
                  onPress={onReset}
                  disabled={!filtersActive}
                  hitSlop={8}
                  style={{ minWidth: 44, minHeight: 44, alignItems: 'flex-end', justifyContent: 'center', opacity: filtersActive ? 1 : 0.35 }}
                >
                  <Text fontSize={13} fontFamily={BIZLINK_FONTS.semibold} color={BIZLINK_COLORS.brand}>
                    Reset
                  </Text>
                </Pressable>
              </XStack>

              <ScrollView
                style={{ flex: 1, paddingHorizontal: 18 }}
                contentContainerStyle={{ paddingTop: 8, paddingBottom: 8 }}
                showsVerticalScrollIndicator={false}
              >
                {children}
              </ScrollView>
            </YStack>
          </Pressable>
        </Animated.View>
      </Pressable>
    </Modal>
  );
}
