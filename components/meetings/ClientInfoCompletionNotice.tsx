import { Text, XStack, YStack } from 'tamagui';
import { BizButton } from '../bizlink/BizButton';
import { BizCard } from '../bizlink/BizCard';
import { useBizlinkColors, BIZLINK_FONTS } from '../../lib/theme';

interface ClientInfoCompletionNoticeProps {
  onCompleteInfo: () => void;
}

/** Inline reminder for direct-to-meeting flows when the client record is incomplete. */
export function ClientInfoCompletionNotice({ onCompleteInfo }: ClientInfoCompletionNoticeProps) {
  const BIZLINK_COLORS = useBizlinkColors();

  return (
    <BizCard flat gap="$2.5" marginTop="$3.5" marginBottom="$3.5">
      <YStack gap="$0.5">
        <Text fontSize={13.5} fontFamily={BIZLINK_FONTS.semibold} color={BIZLINK_COLORS.text}>
          Complete the client's info first
        </Text>
        <Text fontSize={12.5} lineHeight={18} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted}>
          This client is still missing some information. Fill out Complete info so the record is complete.
        </Text>
      </YStack>
      <XStack>
        <BizButton small label="Complete info" variant="white" onPress={onCompleteInfo} />
      </XStack>
    </BizCard>
  );
}
