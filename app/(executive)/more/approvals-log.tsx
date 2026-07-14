import { ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text, XStack, YStack } from 'tamagui';
import { COLORS } from '../../../lib/theme';
import { EXEC_APPROVALS_LOG } from '../../../lib/executive-data';
import { TopBar } from '../../../components/ui/TopBar';
import { Card } from '../../../components/ui/Card';
import { StatusBadge } from '../../../components/ui/StatusBadge';

/** Wireframe x-approvalslog — read-only audit trail ng mga desisyon ng bawat manager. */
export default function ExecutiveApprovalsLogScreen() {
  const insets = useSafeAreaInsets();
  return (
    <YStack flex={1} backgroundColor={COLORS.snow} paddingTop={insets.top}>
      <TopBar title="Approvals Log" />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}>
        <Text fontSize={13} fontWeight="600" color={COLORS.hare} marginBottom="$3" lineHeight={19}>
          Read-only audit trail ng mga naging desisyon ng bawat manager — hindi ka pwedeng mag-override dito.
        </Text>
        {EXEC_APPROVALS_LOG.map((entry) => (
          <Card key={entry.id} marginBottom="$2.5" gap="$1">
            <XStack alignItems="center">
              {entry.type === 'edit' ? (
                <StatusBadge label="Edit" background={COLORS.blueSoft} color={COLORS.blue} />
              ) : (
                <StatusBadge label="Reassign" background={COLORS.amberSoft} color={COLORS.orange} />
              )}
              <Text fontSize={11.5} fontWeight="600" color={COLORS.hare} marginLeft="auto">{entry.date}</Text>
            </XStack>
            <Text fontWeight="800" fontSize={14} color={COLORS.eel}>{entry.clientName}</Text>
            <Text fontSize={11.5} fontWeight="600" color={COLORS.hare}>Handled by {entry.managerName}</Text>
            <XStack alignItems="center" gap="$2">
              <Text fontSize={12.5} fontWeight="700" color={COLORS.eel}>
                {entry.type === 'edit' ? `Edit: ${entry.field}` : 'Reassignment'}
              </Text>
              {entry.decision === 'approved' ? (
                <StatusBadge label="Approved" background={COLORS.greenSoft} color={COLORS.ledgeGreen} />
              ) : (
                <StatusBadge label="Rejected" background={COLORS.redSoft} color={COLORS.ledgeRed} />
              )}
            </XStack>
          </Card>
        ))}
      </ScrollView>
    </YStack>
  );
}
