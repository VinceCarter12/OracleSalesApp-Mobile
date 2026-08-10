import { Modal, Pressable } from 'react-native';
import { Text, XStack, YStack } from 'tamagui';
import { useBizlinkColors, BIZLINK_FONTS } from '../../lib/theme';
import { BizButton } from '../bizlink/BizButton';
import { BizField } from '../bizlink/BizField';
import { MINOR_NOTES_MAX_LENGTH } from '../../lib/field-validation';

interface LostOpportunityDialogProps {
  visible: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  /**
   * Batch: Complete Info "Declare lost opportunity" (Migration 088). When
   * provided, this dialog also renders the wireframe `a-lostDlg`/
   * `a-lostReason` required reason textarea and blocks `onConfirm` until it
   * is non-blank — the meeting-outcome caller (app/(tabs)/meetings/record.tsx)
   * omits this prop and keeps its existing confirm-only behavior unchanged.
   */
  reason?: string;
  onReasonChange?: (text: string) => void;
  /** Shown under the textarea when Confirm is pressed with a blank reason. */
  reasonError?: string | null;
  confirmDisabled?: boolean;
}

/** Wireframe a-lostDlg — confirms before marking a client/meeting as Lost Opportunity. */
export function LostOpportunityDialog({
  visible,
  onCancel,
  onConfirm,
  reason,
  onReasonChange,
  reasonError,
  confirmDisabled = false,
}: LostOpportunityDialogProps) {
  const BIZLINK_COLORS = useBizlinkColors();
  const showReasonField = reason !== undefined && onReasonChange !== undefined;
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
            {showReasonField ? (
              <YStack marginTop="$2.5">
                <BizField
                  label="LOST OPPORTUNITY REASON *"
                  value={reason ?? ''}
                  onChangeText={onReasonChange ?? (() => {})}
                  placeholder="Ilagay kung bakit naging Lost ang client"
                  multiline
                  maxLength={MINOR_NOTES_MAX_LENGTH}
                  hint={
                    reasonError ? (
                      <Text fontSize={11.5} fontFamily={BIZLINK_FONTS.semibold} color={BIZLINK_COLORS.red}>
                        {reasonError}
                      </Text>
                    ) : null
                  }
                />
              </YStack>
            ) : null}
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
              <YStack flex={1}><BizButton label="Confirm" variant="red" onPress={onConfirm} disabled={confirmDisabled} /></YStack>
            </XStack>
          </YStack>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
