import { Modal, Pressable } from 'react-native';
import { Text, YStack } from 'tamagui';
import { useBizlinkColors, BIZLINK_FONTS } from '../../lib/theme';
import { BizButton } from '../bizlink/BizButton';

interface OngoingMeetingWarningDialogProps {
  visible: boolean;
  unavailable: boolean;
  onClose: () => void;
}

/** Branded, non-destructive warning used when a second meeting is blocked. */
export function OngoingMeetingWarningDialog({
  visible,
  unavailable,
  onClose,
}: OngoingMeetingWarningDialogProps) {
  const BIZLINK_COLORS = useBizlinkColors();
  const message = unavailable
    ? "Your ongoing meeting couldn't be checked right now. To avoid a duplicate meeting, try again once the saved data is ready."
    : "You still have an ongoing meeting. Finish or cancel it first before starting a new one.";

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable
        onPress={onClose}
        accessibilityRole="button"
        accessibilityLabel="Close ongoing meeting warning"
        style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center', padding: 24 }}
      >
        <Pressable onPress={(event) => event.stopPropagation()} accessible={false}>
          <YStack accessible accessibilityRole="alert" accessibilityLabel="Ongoing meeting warning" accessibilityViewIsModal backgroundColor={BIZLINK_COLORS.card} borderRadius={24} padding="$4.5" width={320}>
            <Text fontSize={18} fontFamily={BIZLINK_FONTS.semibold} color={BIZLINK_COLORS.orange}>Bawal muna mag-start</Text>
            <Text fontSize={13} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted} marginTop="$2" lineHeight={19}>{message}</Text>
            <YStack marginTop="$4.5">
              <BizButton label="Okay" onPress={onClose} />
            </YStack>
          </YStack>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
