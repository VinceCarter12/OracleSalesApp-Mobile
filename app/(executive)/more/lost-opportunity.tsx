import { ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text, XStack, YStack } from 'tamagui';
import { BIZLINK_COLORS, BIZLINK_FONTS } from '../../../lib/theme';
import { EXEC_LOST_OPP, execAgentById, execManagerById, type ExecLostOppStatus } from '../../../lib/executive-data';
import { BizTopBar } from '../../../components/bizlink/BizTopBar';
import { BizCard } from '../../../components/bizlink/BizCard';
import { StatusBadge } from '../../../components/ui/StatusBadge';

const LOST_STATUS_BADGES: Record<ExecLostOppStatus, { label: string; background: string; color: string }> = {
  'admin-list': { label: 'Sa admin list', background: BIZLINK_COLORS.tintB, color: BIZLINK_COLORS.red },
  released: { label: 'Naka-release na', background: BIZLINK_COLORS.amberSoft, color: BIZLINK_COLORS.orange },
  claimed: { label: 'Claimed', background: BIZLINK_COLORS.tintA, color: BIZLINK_COLORS.brand },
};

/** Wireframe x-lostopp — company-wide lost-opportunity list, Admin-level visibility. */
export default function ExecutiveLostOpportunityScreen() {
  const insets = useSafeAreaInsets();
  return (
    <YStack flex={1} backgroundColor={BIZLINK_COLORS.canvas} paddingTop={insets.top}>
      <BizTopBar title="Lost Opportunity" />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}>
        <Text fontSize={13} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted} marginBottom="$3" lineHeight={19}>
          Company-wide na listahan. Dating &ldquo;admin side lang&rdquo; — ngayon makikita mo rin bilang Executive.
        </Text>
        {EXEC_LOST_OPP.map((lost) => {
          const badge = LOST_STATUS_BADGES[lost.status];
          const agent = execAgentById(lost.agentId);
          const manager = execManagerById(lost.managerId);
          return (
            <BizCard key={lost.id} marginBottom={10} gap="$1">
              <XStack alignItems="center">
                <StatusBadge
                  label={lost.status === 'claimed' && lost.claimedBy ? `Claimed ni ${lost.claimedBy}` : badge.label}
                  background={badge.background}
                  color={badge.color}
                />
                <Text fontSize={11.5} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted} marginLeft="auto">{lost.lostDate}</Text>
              </XStack>
              <Text fontFamily={BIZLINK_FONTS.semibold} fontSize={14} color={BIZLINK_COLORS.text}>{lost.name}</Text>
              <Text fontSize={11.5} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted}>
                {agent?.name ?? '—'} · team ni {manager?.name ?? '—'}
              </Text>
              <Text fontSize={12.5} fontFamily={BIZLINK_FONTS.semibold} color={BIZLINK_COLORS.muted}>{lost.reason}</Text>
            </BizCard>
          );
        })}
      </ScrollView>
    </YStack>
  );
}
