import { ReactNode } from 'react';
import { Hourglass } from 'lucide-react-native';
import { Text, YStack } from 'tamagui';
import { COLORS } from '../../lib/theme';
import { TopBar } from './TopBar';

interface PlaceholderNoticeProps {
  screenTitle: string;
  icon: ReactNode;
  body: string;
  heading?: string;
  badgeLabel?: string;
}

/** Shared "feature not final yet" screen shell — used by role screens that only show a pending notice. */
export function PlaceholderNotice({
  screenTitle,
  icon,
  body,
  heading = 'Hindi pa final ang feature na ito',
  badgeLabel = 'Pending client confirmation',
}: PlaceholderNoticeProps) {
  return (
    <YStack flex={1} backgroundColor={COLORS.snow}>
      <TopBar title={screenTitle} />
      <YStack flex={1} alignItems="center" justifyContent="center" paddingHorizontal="$6" gap="$3">
        {icon}
        <Text fontWeight="800" fontSize={14} color={COLORS.eel} textAlign="center">
          {heading}
        </Text>
        <Text fontSize={13} fontWeight="600" color={COLORS.hare} textAlign="center" lineHeight={19}>
          {body}
        </Text>
        <YStack flexDirection="row" alignItems="center" gap="$1.5" marginTop="$1">
          <Hourglass size={14} color={COLORS.orange} />
          <Text fontWeight="800" fontSize={12.5} color={COLORS.orange}>{badgeLabel}</Text>
        </YStack>
      </YStack>
    </YStack>
  );
}
