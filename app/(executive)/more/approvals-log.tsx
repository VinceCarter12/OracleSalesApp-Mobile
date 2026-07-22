import { ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Spinner, Text, XStack, YStack } from 'tamagui';
import { BIZLINK_COLORS, BIZLINK_FONTS } from '../../../lib/theme';
import { useExecutiveTagAlongLog } from '../../../lib/use-executive-tagalong-log';
import { BizTopBar } from '../../../components/bizlink/BizTopBar';
import { BizCard } from '../../../components/bizlink/BizCard';
import { BizButton } from '../../../components/bizlink/BizButton';
import { StatusBadge } from '../../../components/ui/StatusBadge';

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

const INVITEE_KIND_LABEL: Record<'manager' | 'teammate', string> = {
  manager: 'Manager',
  teammate: 'Teammate',
};

/**
 * Wireframe x-approvalslog slot — REPURPOSED (B-060, 2026-07-23). The old
 * concept (manager edit/reassignment approval history) is dead: F-205
 * removed the entire Manager Approvals workflow, so no such history could
 * ever exist. This screen now shows a real, company-wide **Tag-Along
 * accept/decline decision history** — read-only, Executive visibility, via
 * lib/executive-tagalong-log-service.ts.
 */
export default function ExecutiveTagAlongLogScreen() {
  const insets = useSafeAreaInsets();
  const { items, loading, error, reload } = useExecutiveTagAlongLog();

  return (
    <YStack flex={1} backgroundColor={BIZLINK_COLORS.canvas} paddingTop={insets.top}>
      <BizTopBar title="Tag-Along Log" />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}>
        <Text fontSize={13} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted} marginBottom="$3" lineHeight={19}>
          Read-only history ng mga tag-along request na tinanggap o tinanggihan, company-wide — hindi ka pwedeng mag-override dito.
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
              Wala pang tinanggap o tinanggihang tag-along request.
            </Text>
          </YStack>
        ) : (
          items.map((entry) => (
            <BizCard key={entry.id} marginBottom={10} gap="$1">
              <XStack alignItems="center">
                <StatusBadge
                  label={INVITEE_KIND_LABEL[entry.inviteeKind]}
                  background={BIZLINK_COLORS.soft}
                  color={BIZLINK_COLORS.navy}
                />
                <Text fontSize={11.5} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted} marginLeft="auto">
                  {formatDate(entry.respondedAt)}
                </Text>
              </XStack>
              <Text fontFamily={BIZLINK_FONTS.semibold} fontSize={14} color={BIZLINK_COLORS.text}>
                {entry.clientName ?? '—'}
              </Text>
              <Text fontSize={11.5} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted}>
                {entry.requesterName ?? '—'} tinag-along si {entry.inviteeName ?? '—'}
              </Text>
              <XStack alignItems="center" gap="$2">
                <Text fontSize={12.5} fontFamily={BIZLINK_FONTS.semibold} color={BIZLINK_COLORS.text}>Desisyon</Text>
                {entry.decision === 'accepted' ? (
                  <StatusBadge label="Tinanggap" background={BIZLINK_COLORS.tintA} color={BIZLINK_COLORS.brand} />
                ) : (
                  <StatusBadge label="Tinanggihan" background={BIZLINK_COLORS.tintB} color={BIZLINK_COLORS.red} />
                )}
              </XStack>
            </BizCard>
          ))
        )}
      </ScrollView>
    </YStack>
  );
}
