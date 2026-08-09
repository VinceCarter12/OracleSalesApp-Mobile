import { Spinner, Text, XStack } from 'tamagui';
import { BIZLINK_COLORS, BIZLINK_FONTS } from '../../lib/theme';
import { BizButton } from '../bizlink/BizButton';
import type { ManagerScope } from '../../lib/manager-scope';

interface ManagerTeamMapStatusBannerProps {
  scope: ManagerScope;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
}

/** Manager Maps "My Team"/"Combined" live-fetch loading/error affordance — split out to keep app/(manager)/more/maps.tsx under the 300-line cap. */
export function ManagerTeamMapStatusBanner({ scope, loading, error, onRetry }: ManagerTeamMapStatusBannerProps) {
  if (scope === 'mine') return null;

  if (error) {
    return (
      <XStack alignItems="center" justifyContent="space-between" gap="$2" backgroundColor={BIZLINK_COLORS.amberSoft} borderRadius={16} paddingHorizontal={14} paddingVertical={10} marginTop="$3">
        <Text flex={1} fontSize={12} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.orange}>
          {error}
        </Text>
        <BizButton small label="Ulitin" variant="white" onPress={onRetry} />
      </XStack>
    );
  }

  if (loading) {
    return (
      <XStack alignItems="center" gap="$2" marginTop="$3">
        <Spinner size="small" color={BIZLINK_COLORS.brand} />
        <Text fontSize={12} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted}>Naglo-load ang team data...</Text>
      </XStack>
    );
  }

  return null;
}
