import { WifiOff } from 'lucide-react-native';
import { Text, XStack } from 'tamagui';
import { useBizlinkColors, BIZLINK_FONTS } from '../../lib/theme';

interface BizOfflineNoticeProps {
  message: string;
}

/**
 * Amber "needs internet" notice — same visual language as
 * `components/maps/MapsScreenSections.tsx`'s `OfflineBanner` (WifiOff icon,
 * amber-soft chip), colocated here instead of imported from that maps-only
 * module (its own doc comment: "Shared maps-only presentational pieces")
 * since this is used by non-maps screens (Manager Approvals/Notifications,
 * 2026-08-16 — `get_manager_approval_feed()` is an online-only RPC with no
 * local SQLite mirror, ADR-044 decision 5). Distinct from a generic
 * error-with-retry box: this is honest "this feature needs internet" copy,
 * not "something went wrong".
 */
export function BizOfflineNotice({ message }: BizOfflineNoticeProps) {
  const BIZLINK_COLORS = useBizlinkColors();
  return (
    <XStack alignItems="center" gap="$2" backgroundColor={BIZLINK_COLORS.amberSoft} borderRadius={16} paddingHorizontal={14} paddingVertical={10}>
      <WifiOff size={14} color={BIZLINK_COLORS.orange} strokeWidth={1.75} />
      <Text flex={1} fontSize={12} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.orange} lineHeight={17}>
        {message}
      </Text>
    </XStack>
  );
}
