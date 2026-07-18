import { ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text, XStack, YStack } from 'tamagui';
import { BIZLINK_COLORS, BIZLINK_FONTS } from '../../../lib/theme';
import { EXEC_APPROVALS_LOG } from '../../../lib/executive-data';
import { BizTopBar } from '../../../components/bizlink/BizTopBar';
import { BizCard } from '../../../components/bizlink/BizCard';
import { StatusBadge } from '../../../components/ui/StatusBadge';

/** Wireframe x-approvalslog — read-only audit trail ng mga desisyon ng bawat manager. */
export default function ExecutiveApprovalsLogScreen() {
  const insets = useSafeAreaInsets();
  return (
    <YStack flex={1} backgroundColor={BIZLINK_COLORS.canvas} paddingTop={insets.top}>
      <BizTopBar title="Approvals Log" />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}>
        <Text fontSize={13} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted} marginBottom="$3" lineHeight={19}>
          Read-only audit trail ng mga naging desisyon ng bawat manager — hindi ka pwedeng mag-override dito.
        </Text>
        {EXEC_APPROVALS_LOG.map((entry) => (
          <BizCard key={entry.id} marginBottom={10} gap="$1">
            <XStack alignItems="center">
              {entry.type === 'edit' ? (
                <StatusBadge label="Edit" background={BIZLINK_COLORS.soft} color={BIZLINK_COLORS.navy} />
              ) : (
                <StatusBadge label="Reassign" background={BIZLINK_COLORS.amberSoft} color={BIZLINK_COLORS.orange} />
              )}
              <Text fontSize={11.5} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted} marginLeft="auto">{entry.date}</Text>
            </XStack>
            <Text fontFamily={BIZLINK_FONTS.semibold} fontSize={14} color={BIZLINK_COLORS.text}>{entry.clientName}</Text>
            <Text fontSize={11.5} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted}>Handled by {entry.managerName}</Text>
            <XStack alignItems="center" gap="$2">
              <Text fontSize={12.5} fontFamily={BIZLINK_FONTS.semibold} color={BIZLINK_COLORS.text}>
                {entry.type === 'edit' ? `Edit: ${entry.field}` : 'Reassignment'}
              </Text>
              {entry.decision === 'approved' ? (
                <StatusBadge label="Approved" background={BIZLINK_COLORS.tintA} color={BIZLINK_COLORS.brand} />
              ) : (
                <StatusBadge label="Rejected" background={BIZLINK_COLORS.tintB} color={BIZLINK_COLORS.red} />
              )}
            </XStack>
          </BizCard>
        ))}
      </ScrollView>
    </YStack>
  );
}
