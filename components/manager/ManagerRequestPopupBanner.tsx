import { useEffect, useRef } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Bell } from 'lucide-react-native';
import { Text, View } from 'tamagui';
import { useBizlinkColors, BIZLINK_FONTS } from '../../lib/theme';

interface ManagerRequestPopupBannerProps {
  visible: boolean;
  count: number;
  onPress: () => void;
  onDismiss: () => void;
}

// 2026-08-16 (Vince direct on-device feedback): replaces the old centered
// `Modal` dialog with two buttons ("Later" / "View requests"). Confirmed
// interaction model: tapping the banner anywhere navigates to Manager
// Requests (same destination as the old "View requests" action); there is
// no manual dismiss control — it auto-dismisses on its own after
// AUTO_DISMISS_DELAY_MS. Positioned as a floating top banner below the
// status bar/notch (via `insets.top`), not a full-screen dimmed dialog —
// follows `components/sync/SyncUploadProgressCard.tsx`'s existing
// floating-top-banner precedent (`position: 'absolute'`, mounted globally,
// no backdrop) rather than inventing a new pattern.
//
// A notification banner needs enough time to actually be read, not just
// glanced at — SyncUploadProgressCard's own auto-dismiss
// (`DONE_DISMISS_DELAY_MS`) is 2000ms, but that's a short "Done" checkmark
// confirmation, not text the Manager has to read and decide whether to act
// on. 5000ms sits in the typical 4-6s range for a toast/banner meant to be
// read.
const AUTO_DISMISS_DELAY_MS = 5000;

export function ManagerRequestPopupBanner({ visible, count, onPress, onDismiss }: ManagerRequestPopupBannerProps) {
  const colors = useBizlinkColors();
  const insets = useSafeAreaInsets();
  const dismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (dismissTimerRef.current) {
      clearTimeout(dismissTimerRef.current);
      dismissTimerRef.current = null;
    }
    if (visible) {
      dismissTimerRef.current = setTimeout(onDismiss, AUTO_DISMISS_DELAY_MS);
    }
    return () => {
      if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current);
    };
  }, [visible, onDismiss]);

  if (!visible) return null;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${count} new ${count === 1 ? 'request' : 'requests'} need your decision. Tap to view.`}
      style={{ position: 'absolute', top: insets.top + 8, left: 16, right: 16, zIndex: 50 }}
    >
      <View
        backgroundColor={colors.card}
        borderRadius={24}
        paddingHorizontal={16}
        paddingVertical={14}
        minHeight={44}
        flexDirection="row"
        alignItems="center"
        gap={12}
        style={styles.shadow}
      >
        <Bell size={20} color={colors.brand} strokeWidth={1.75} />
        <View flex={1} gap={2}>
          <Text fontSize={14} fontFamily={BIZLINK_FONTS.semibold} color={colors.text}>
            New requests
          </Text>
          <Text fontSize={12} fontFamily={BIZLINK_FONTS.medium} color={colors.muted} lineHeight={17}>
            May {count} {count === 1 ? 'request' : 'requests'} na kailangan ng decision.
          </Text>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  shadow: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 4,
  },
});
