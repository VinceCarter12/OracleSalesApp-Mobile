import { Modal, Pressable } from 'react-native';
import { Text, YStack } from 'tamagui';
import { BIZLINK_FONTS, useBizlinkColors } from '../../lib/theme';
import { BizButton } from '../bizlink/BizButton';

interface Props {
  visible: boolean;
  onContinue: () => void;
  onCancel: () => void;
}

/**
 * B-125 (Vince, 2026-08-20). Distinct from `SameClientPoBlockedDialog`, which
 * is the hard block for a PO the SERVER has already accepted.
 *
 * This one covers the opposite case: PO evidence that only ever existed on
 * this device (`draft` / `duplicate_blocked` / `superseded`) and never reached
 * Supabase. That holds no real reservation, so it must not lock the agent out
 * of filing a PO for this client — it warns, and continuing replaces it.
 *
 * Deliberately warns rather than proceeding silently: the agent should know a
 * previous attempt exists and did not send, since that is usually a symptom
 * worth reporting, not just bookkeeping.
 */
export function PoOverwriteWarningDialog({ visible, onContinue, onCancel }: Props) {
  const colors = useBizlinkColors();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <Pressable
        onPress={onCancel}
        style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center', padding: 24 }}
      >
        <Pressable onPress={(event) => event.stopPropagation()} accessible={false}>
          <YStack
            accessible
            accessibilityRole="alert"
            accessibilityViewIsModal
            backgroundColor={colors.card}
            borderRadius={24}
            padding="$4.5"
            width={320}
          >
            <Text fontSize={18} fontFamily={BIZLINK_FONTS.semibold} color={colors.orange}>
              Replace earlier PO photo?
            </Text>
            <Text fontSize={13} fontFamily={BIZLINK_FONTS.medium} color={colors.muted} marginTop="$2" lineHeight={19}>
              An earlier purchase order photo for this client was saved on this phone but never reached the office.
              Continuing replaces it with the photo you just took.
            </Text>
            <YStack gap="$2" marginTop="$4">
              <BizButton label="Continue and replace" onPress={onContinue} />
              <BizButton label="Cancel" variant="white" onPress={onCancel} />
            </YStack>
          </YStack>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
