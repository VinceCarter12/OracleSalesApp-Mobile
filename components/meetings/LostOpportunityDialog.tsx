import { Modal, Pressable } from 'react-native';
import { Text, XStack, YStack } from 'tamagui';
import { COLORS } from '../../lib/theme';
import { DuoButton } from '../ui/DuoButton';

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
          <YStack backgroundColor={COLORS.snow} borderRadius={20} padding="$4.5" width={320}>
            <Text fontSize={18} fontWeight="800" color={COLORS.ledgeRed}>Lost opportunity?</Text>
            <Text fontSize={13} fontWeight="600" color={COLORS.eel} marginTop="$2">
              Kapag kinumpirma:
            </Text>
            <Text fontSize={13} fontWeight="600" color={COLORS.hare} marginTop="$1" lineHeight={19}>
              • Matatanggal ang client sa listahan mo{'\n'}
              • Mapupunta sa admin-side list{'\n'}
              • Kapag ni-release ulit, ibang agents lang ang pwedeng kumuha
            </Text>
            <XStack gap="$2.5" marginTop="$4.5">
              <YStack flex={1}><DuoButton label="Cancel" variant="white" onPress={onCancel} /></YStack>
              <YStack flex={1}><DuoButton label="Confirm" variant="red" onPress={onConfirm} /></YStack>
            </XStack>
          </YStack>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
