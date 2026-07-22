import { ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Spinner, Text, XStack, YStack } from 'tamagui';
import { BIZLINK_COLORS, BIZLINK_FONTS } from '../../../lib/theme';
import {
  useExecutiveLostOpportunities,
} from '../../../lib/use-executive-lost-opportunities';
import type { ExecLostOpportunityStatus } from '../../../lib/executive-lost-opportunity-service';
import { BizTopBar } from '../../../components/bizlink/BizTopBar';
import { BizCard } from '../../../components/bizlink/BizCard';
import { BizButton } from '../../../components/bizlink/BizButton';
import { StatusBadge } from '../../../components/ui/StatusBadge';

const LOST_STATUS_BADGES: Record<ExecLostOpportunityStatus, { label: string; background: string; color: string }> = {
  cooldown: { label: 'Sa cooldown (14 araw)', background: BIZLINK_COLORS.tintB, color: BIZLINK_COLORS.red },
  released: { label: 'Naka-release na', background: BIZLINK_COLORS.amberSoft, color: BIZLINK_COLORS.orange },
};

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/**
 * Wireframe x-lostopp — company-wide lost-opportunity list, Admin-level
 * visibility. Real data (B-060 addendum, 2026-07-23) via
 * lib/executive-lost-opportunity-service.ts. Status is DERIVED from
 * `reassignable_at` vs now (cooldown/released), not a real column — see that
 * service's header comment. "Claimed by" is deliberately omitted: once
 * another agent claims a lost client, the row's `status` moves away from
 * `'lost'` entirely (so it drops out of this list), and there is no column
 * tracking the original agent who lost it — nothing reliable to show.
 */
export default function ExecutiveLostOpportunityScreen() {
  const insets = useSafeAreaInsets();
  const { items, loading, error, reload } = useExecutiveLostOpportunities();

  return (
    <YStack flex={1} backgroundColor={BIZLINK_COLORS.canvas} paddingTop={insets.top}>
      <BizTopBar title="Lost Opportunity" />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}>
        <Text fontSize={13} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted} marginBottom="$3" lineHeight={19}>
          Company-wide na listahan. Dating &ldquo;admin side lang&rdquo; — ngayon makikita mo rin bilang Executive.
        </Text>

        {loading ? (
          <YStack alignItems="center" paddingVertical="$6">
            <Spinner size="large" color={BIZLINK_COLORS.brand} />
          </YStack>
        ) : error ? (
          <YStack alignItems="center" paddingVertical="$6" gap="$3">
            <Text fontSize={13} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted} textAlign="center">{error}</Text>
            <BizButton small label="Ulitin" variant="white" onPress={reload} />
          </YStack>
        ) : items.length === 0 ? (
          <YStack alignItems="center" paddingVertical="$6">
            <Text fontSize={13} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted}>
              Walang lost opportunity sa ngayon.
            </Text>
          </YStack>
        ) : (
          items.map((lost) => {
            const badge = LOST_STATUS_BADGES[lost.status];
            return (
              <BizCard key={lost.id} marginBottom={10} gap="$1">
                <XStack alignItems="center">
                  <StatusBadge label={badge.label} background={badge.background} color={badge.color} />
                  <Text fontSize={11.5} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted} marginLeft="auto">
                    {formatDate(lost.lostAt)}
                  </Text>
                </XStack>
                <Text fontFamily={BIZLINK_FONTS.semibold} fontSize={14} color={BIZLINK_COLORS.text}>{lost.companyName}</Text>
                <Text fontSize={11.5} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted}>
                  {lost.agentName ?? '—'} · team ni {lost.managerName ?? '—'}
                </Text>
                <Text fontSize={12.5} fontFamily={BIZLINK_FONTS.semibold} color={BIZLINK_COLORS.muted}>
                  {lost.reason ?? 'Walang naitalang dahilan'}
                </Text>
              </BizCard>
            );
          })
        )}
      </ScrollView>
    </YStack>
  );
}
