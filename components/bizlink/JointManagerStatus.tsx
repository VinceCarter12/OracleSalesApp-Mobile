import { Text, XStack, YStack } from 'tamagui';
import { BIZLINK_FONTS, useBizlinkColors } from '../../lib/theme';
import { formatJointApprovalStatus } from '../../lib/policies/joint-manager-policy';

interface Props { holderNames: readonly string[]; originTeamName: string | null; requiredCount: 1 | 2; approvedCount: number; declined: boolean; }

export function JointManagerStatus({ holderNames, originTeamName, requiredCount, approvedCount, declined }: Props) {
  const colors = useBizlinkColors();
  return <YStack gap="$1" padding="$2" borderRadius={10} backgroundColor={colors.card} borderWidth={1} borderColor={colors.line}>
    <XStack gap="$2" flexWrap="wrap"><Text fontFamily={BIZLINK_FONTS.semibold} color={colors.text}>Holder: {holderNames.length ? holderNames.join(', ') : 'Pending approval'}</Text><Text fontFamily={BIZLINK_FONTS.medium} color={colors.muted}>Origin: {originTeamName ?? 'Unknown team'}</Text></XStack>
    <Text fontFamily={BIZLINK_FONTS.medium} fontSize={12} color={declined ? colors.red : colors.brand}>{formatJointApprovalStatus(requiredCount, approvedCount, declined)}</Text>
  </YStack>;
}
