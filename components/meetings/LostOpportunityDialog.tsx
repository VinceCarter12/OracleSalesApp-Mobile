import { Modal, Pressable } from 'react-native';
import { Text, XStack, YStack } from 'tamagui';
import { BIZLINK_COLORS, BIZLINK_FONTS } from '../../lib/theme';
import { BizButton } from '../bizlink/BizButton';

interface LostOpportunityDialogProps {
  visible: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

/** Wireframe a-lostDlg — confirms before marking a meeting outcome as Lost Opportunity. */
export function LostOpportunityDialog({ visible, onCancel, onConfirm }: LostOpportunityDialogProps) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <Pressable
        onPress={onCancel}
        style={{
          flex: 1,
          backgroundColor: 'rgba(0,0,0,0.5)',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 24,
        }}
      >
        <Pressable onPress={(e) => e.stopPropagation()}>
          <YStack backgroundColor={BIZLINK_COLORS.card} borderRadius={24} padding="$4.5" width={320}>
            <Text fontSize={18} fontFamily={BIZLINK_FONTS.semibold} color={BIZLINK_COLORS.red}>Lost opportunity?</Text>
            <Text fontSize={13} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.text} marginTop="$2">
              Kapag kinumpirma:
            </Text>
            <Text fontSize={13} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted} marginTop="$1" lineHeight={19}>
              • Matatanggal ang client sa listahan mo{'\n'}
              • Mapupunta sa admin-side list{'\n'}
              • Kapag ni-release ulit, ibang agents lang ang pwedeng kumuha
            </Text>
            <XStack gap="$2.5" marginTop="$4.5">
              <YStack flex={1}><BizButton label="Cancel" variant="white" onPress={onCancel} /></YStack>
              <YStack flex={1}><BizButton label="Confirm" variant="red" onPress={onConfirm} /></YStack>
            </XStack>
          </YStack>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
