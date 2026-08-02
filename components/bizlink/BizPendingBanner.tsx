import { Clock } from 'lucide-react-native';
import { Text, XStack, YStack } from 'tamagui';
import { useBizlinkColors, BIZLINK_FONTS } from '../../lib/theme';

interface BizPendingBannerProps {
  /** ISO timestamp the request was created — formatted here, not by the caller. */
  since: string;
}

function formatSince(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

/**
 * Design-System-Catalog §"Needed before implementation" BizPendingBanner —
 * "Request pending since [date], awaiting manager review." Mirrors
 * Wireframe-Manager-BizLink.html's `.pendbanner` (line 273: amber-soft
 * background, clock icon, ~amber-brown text).
 *
 * Batch 6 PR D note: this file also exists on `feat/batch6-prb-manager-
 * approvals-screen` (PR #29, unmerged at PR D implementation time) —
 * byte-identical, copied against that PR's already-quality-gated interface
 * rather than branching off it, per Batch 6's PR sequencing notes. Whichever
 * PR merges first "wins"; the other's identical file merges as a no-op.
 */
export function BizPendingBanner({ since }: BizPendingBannerProps) {
  const BIZLINK_COLORS = useBizlinkColors();
  return (
    <XStack
      alignItems="center"
      gap="$2.5"
      backgroundColor={BIZLINK_COLORS.amberSoft}
      borderRadius={20}
      paddingHorizontal={16}
      paddingVertical={13}
    >
      <Clock size={16} color={BIZLINK_COLORS.orange} strokeWidth={1.75} />
      <YStack flex={1}>
        <Text fontSize={12} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.orange} lineHeight={17}>
          Request pending since {formatSince(since)} — awaiting manager review.
        </Text>
      </YStack>
    </XStack>
  );
}
