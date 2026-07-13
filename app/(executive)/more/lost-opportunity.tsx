import { ScrollView } from 'react-native';
import { Text, XStack, YStack } from 'tamagui';
import { COLORS } from '../../../lib/theme';
import { EXEC_LOST_OPP, execAgentById, execManagerById, type ExecLostOppStatus } from '../../../lib/executive-data';
import { TopBar } from '../../../components/ui/TopBar';
import { Card } from '../../../components/ui/Card';
import { StatusBadge } from '../../../components/ui/StatusBadge';

const LOST_STATUS_BADGES: Record<ExecLostOppStatus, { label: string; background: string; color: string }> = {
  'admin-list': { label: 'Sa admin list', background: COLORS.redSoft, color: COLORS.ledgeRed },
  released: { label: 'Naka-release na', background: COLORS.amberSoft, color: COLORS.orange },
  claimed: { label: 'Claimed', background: COLORS.greenSoft, color: COLORS.ledgeGreen },
};

/** Wireframe x-lostopp — company-wide lost-opportunity list, Admin-level visibility. */
export default function ExecutiveLostOpportunityScreen() {
  return (
    <YStack flex={1} backgroundColor={COLORS.snow}>
      <TopBar title="Lost Opportunity" />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}>
        <Text fontSize={13} fontWeight="600" color={COLORS.hare} marginBottom="$3" lineHeight={19}>
          Company-wide na listahan. Dating "admin side lang" — ngayon makikita mo rin bilang Executive.
        </Text>
        {EXEC_LOST_OPP.map((lost) => {
          const badge = LOST_STATUS_BADGES[lost.status];
          const agent = execAgentById(lost.agentId);
          const manager = execManagerById(lost.managerId);
          return (
            <Card key={lost.id} marginBottom="$2.5" gap="$1">
              <XStack alignItems="center">
                <StatusBadge
                  label={lost.status === 'claimed' && lost.claimedBy ? `Claimed ni ${lost.claimedBy}` : badge.label}
                  background={badge.background}
                  color={badge.color}
                />
                <Text fontSize={11.5} fontWeight="600" color={COLORS.hare} marginLeft="auto">{lost.lostDate}</Text>
              </XStack>
              <Text fontWeight="800" fontSize={14} color={COLORS.eel}>{lost.name}</Text>
              <Text fontSize={11.5} fontWeight="600" color={COLORS.hare}>
                {agent?.name ?? '—'} · team ni {manager?.name ?? '—'}
              </Text>
              <Text fontSize={12.5} fontWeight="700" color={COLORS.wolf}>{lost.reason}</Text>
            </Card>
          );
        })}
      </ScrollView>
    </YStack>
  );
}
