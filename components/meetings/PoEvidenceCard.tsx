import { Image } from 'react-native';
import { Camera, Check, FileCheck2, FileImage, ImagePlus } from 'lucide-react-native';
import { Text, XStack, YStack } from 'tamagui';
import { useBizlinkColors, BIZLINK_FONTS } from '../../lib/theme';
import { BizButton } from '../bizlink/BizButton';

interface PoEvidenceCardProps {
  visible: boolean;
  photoUri: string | null;
  busy: boolean;
  onTakePhoto: () => void;
  onChooseFromGallery: () => void;
  onChooseFromFiles: () => void;
  onPreview: () => void;
}

/**
 * Close Deal evidence stays local until Save. Replacing it before Save only
 * changes the pending local URI, so it cannot create a duplicate approval.
 */
export function PoEvidenceCard({
  visible, photoUri, busy, onTakePhoto, onChooseFromGallery, onChooseFromFiles, onPreview,
}: PoEvidenceCardProps) {
  const colors = useBizlinkColors();
  if (!visible) return null;

  return (
    <YStack backgroundColor={colors.card} borderRadius={20} padding={16} marginTop="$2.5" gap="$1.5">
      <YStack flexDirection="row" alignItems="center" gap="$2">
        {photoUri ? <Check size={16} color={colors.brand} strokeWidth={1.75} /> : <FileCheck2 size={16} color={colors.text} strokeWidth={1.75} />}
        <Text fontSize={13} fontFamily={BIZLINK_FONTS.semibold} color={colors.text}>
          {photoUri ? 'PO evidence ready to submit' : 'PO evidence required'}
        </Text>
      </YStack>

      {photoUri ? (
        <XStack alignItems="center" gap="$2" marginTop="$1">
          <Image source={{ uri: photoUri }} style={{ width: 52, height: 52, borderRadius: 12 }} resizeMode="cover" />
          <YStack flex={1} gap="$1">
            <Text fontSize={11.5} fontFamily={BIZLINK_FONTS.medium} color={colors.muted} lineHeight={16}>
              Review it before saving. You can replace a wrong attachment.
            </Text>
            <BizButton label="Preview evidence" variant="white" small onPress={onPreview} />
          </YStack>
        </XStack>
      ) : (
        <Text fontSize={12} fontFamily={BIZLINK_FONTS.medium} color={colors.muted} lineHeight={17}>
          Attach an image from your camera, gallery, or Files. When online, it will be sent for Manager approval.
        </Text>
      )}

      <YStack gap="$2" marginTop="$1">
        <BizButton label={photoUri ? 'Replace with camera' : busy ? 'Opening source...' : 'Take photo'} variant="white" small disabled={busy} icon={<Camera size={14} color={colors.text} strokeWidth={1.75} />} onPress={onTakePhoto} />
        <BizButton label="Choose from gallery" variant="white" small disabled={busy} icon={<ImagePlus size={14} color={colors.text} strokeWidth={1.75} />} onPress={onChooseFromGallery} />
        <BizButton label="Choose image from Files" variant="white" small disabled={busy} icon={<FileImage size={14} color={colors.text} strokeWidth={1.75} />} onPress={onChooseFromFiles} />
      </YStack>
    </YStack>
  );
}
