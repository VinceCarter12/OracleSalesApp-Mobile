import { Modal, Pressable } from 'react-native';
import { Text, XStack, YStack } from 'tamagui';
import { useBizlinkColors, BIZLINK_FONTS } from '../../lib/theme';
import { BizButton } from '../bizlink/BizButton';

interface TagAlongWarningDialogProps { visible: boolean; onCancel: () => void; onContinue: () => void; }

/** Confirms a new, separate visit without cancelling an existing Tag-Along request. */
export function TagAlongWarningDialog({ visible, onCancel, onContinue }: TagAlongWarningDialogProps) {
  const colors = useBizlinkColors();
  return <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
    <Pressable onPress={onCancel} style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <Pressable onPress={(event) => event.stopPropagation()} accessible={false}>
        <YStack accessible accessibilityRole="alert" accessibilityViewIsModal backgroundColor={colors.card} borderRadius={24} padding="$4.5" width={320}>
          <Text fontSize={18} fontFamily={BIZLINK_FONTS.semibold} color={colors.orange}>Tag-Along request already active</Text>
          <Text fontSize={13} fontFamily={BIZLINK_FONTS.medium} color={colors.muted} marginTop="$2" lineHeight={19}>This keeps the existing request. Continue only if this is a new, separate visit.</Text>
          <XStack gap="$2.5" marginTop="$4.5"><YStack flex={1}><BizButton label="Cancel" variant="white" onPress={onCancel} /></YStack><YStack flex={1}><BizButton label="Continue" onPress={onContinue} /></YStack></XStack>
        </YStack>
      </Pressable>
    </Pressable>
  </Modal>;
}
