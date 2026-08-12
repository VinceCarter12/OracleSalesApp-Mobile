import { Modal, Pressable } from 'react-native';
import { Text, XStack, YStack } from 'tamagui';
import { useBizlinkColors, BIZLINK_FONTS } from '../../lib/theme';
import { BizButton } from '../bizlink/BizButton';

interface CancelMeetingDialogProps {
  visible: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

/**
 * Emerald BizLink destructive confirmation. This deliberately follows the
 * established meeting dialog pattern used by StartMeetingConfirmDialog and
 * LostOpportunityDialog instead of using a native Alert.
 */
export function CancelMeetingDialog({ visible, onCancel, onConfirm }: CancelMeetingDialogProps) {
  const BIZLINK_COLORS = useBizlinkColors();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <Pressable
        onPress={onCancel}
        accessibilityRole="button"
        accessibilityLabel="Close cancel meeting confirmation"
        style={{
          flex: 1,
          backgroundColor: 'rgba(0,0,0,0.5)',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 24,
        }}
      >
        <Pressable onPress={(event) => event.stopPropagation()} accessible={false}>
          <YStack
            accessible
            accessibilityRole="alert"
            accessibilityLabel="Cancel meeting confirmation"
            accessibilityViewIsModal
            backgroundColor={BIZLINK_COLORS.card}
            borderRadius={24}
            padding="$4.5"
            width={320}
          >
            <Text fontSize={18} fontFamily={BIZLINK_FONTS.semibold} color={BIZLINK_COLORS.red}>
              Cancel meeting?
            </Text>
            <Text fontSize={13} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted} marginTop="$2" lineHeight={19}>
              The current draft will be discarded and won't be saved or submitted.
            </Text>
            <XStack gap="$2.5" marginTop="$4.5">
              <YStack flex={1} accessible accessibilityRole="button" accessibilityLabel="Keep meeting">
                <BizButton label="Keep meeting" variant="white" onPress={onCancel} />
              </YStack>
              <YStack flex={1} accessible accessibilityRole="button" accessibilityLabel="Cancel meeting">
                <BizButton label="Cancel meeting" variant="red" onPress={onConfirm} />
              </YStack>
            </XStack>
          </YStack>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
