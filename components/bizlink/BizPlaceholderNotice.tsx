import { ReactNode } from 'react';
import { Hourglass } from 'lucide-react-native';
import { Text, YStack } from 'tamagui';
import { BIZLINK_COLORS, BIZLINK_FONTS } from '../../lib/theme';
import { BizTopBar } from './BizTopBar';

interface BizPlaceholderNoticeProps {
  screenTitle: string;
  icon: ReactNode;
  body: string;
  heading?: string;
  badgeLabel?: string;
  /** See `BizTopBar`'s own `fallbackHref` doc — needed for screens reachable by a direct cross-tab push. */
  fallbackHref?: string;
}

/** T-014 Phase 2 (ADR-024): BizLink "feature not final" empty-state shell. Replaces `PlaceholderNotice` within `app/(tabs)`. */
export function BizPlaceholderNotice({
  screenTitle,
  icon,
  body,
  heading = 'Hindi pa final ang feature na ito',
  badgeLabel = 'Pending client confirmation',
  fallbackHref,
}: BizPlaceholderNoticeProps) {
  return (
    <YStack flex={1} backgroundColor={BIZLINK_COLORS.canvas}>
      <BizTopBar title={screenTitle} fallbackHref={fallbackHref} />
      <YStack flex={1} alignItems="center" justifyContent="center" paddingHorizontal="$6" gap="$3">
        {icon}
        <Text fontFamily={BIZLINK_FONTS.semibold} fontSize={14} color={BIZLINK_COLORS.text} textAlign="center">
          {heading}
        </Text>
        <Text fontSize={13} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted} textAlign="center" lineHeight={19}>
          {body}
        </Text>
        <YStack flexDirection="row" alignItems="center" gap="$1.5" marginTop="$1">
          <Hourglass size={14} color={BIZLINK_COLORS.orange} strokeWidth={1.75} />
          <Text fontFamily={BIZLINK_FONTS.semibold} fontSize={12.5} color={BIZLINK_COLORS.orange}>{badgeLabel}</Text>
        </YStack>
      </YStack>
    </YStack>
  );
}
