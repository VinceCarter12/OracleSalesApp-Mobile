import { Modal, Pressable } from 'react-native';
import { Text, XStack, YStack } from 'tamagui';
import { useBizlinkColors, BIZLINK_FONTS } from '../../lib/theme';
import { BizButton } from '../bizlink/BizButton';

interface OfficeLocationConfirmDialogProps {
  visible: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

export function OfficeLocationConfirmDialog({ visible, onCancel, onConfirm }: OfficeLocationConfirmDialogProps) {
  const colors = useBizlinkColors();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <Pressable onPress={onCancel} accessibilityRole="button" accessibilityLabel="Close office location confirmation" style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <Pressable onPress={(event) => event.stopPropagation()} accessible={false}>
          <YStack accessible accessibilityRole="alert" accessibilityLabel="Confirm office location" accessibilityViewIsModal backgroundColor={colors.card} borderRadius={24} padding="$4.5" width={320}>
            <Text fontSize={18} fontFamily={BIZLINK_FONTS.semibold} color={colors.text}>Save office location?</Text>
            <Text fontSize={13} fontFamily={BIZLINK_FONTS.medium} color={colors.muted} marginTop="$2" lineHeight={19}>This pin will be used as the client’s office location. You can update it later.</Text>
            <XStack gap="$2.5" marginTop="$4.5">
              <YStack flex={1} accessible accessibilityRole="button" accessibilityLabel="Keep editing location"><BizButton label="Keep editing" variant="white" onPress={onCancel} /></YStack>
              <YStack flex={1} accessible accessibilityRole="button" accessibilityLabel="Save office location"><BizButton label="Save location" onPress={onConfirm} /></YStack>
            </XStack>
          </YStack>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
