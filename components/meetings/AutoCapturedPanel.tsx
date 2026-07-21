import { Image, Pressable } from 'react-native';
import { Camera, Check } from 'lucide-react-native';
import { Text, XStack, YStack } from 'tamagui';
import { BIZLINK_COLORS, BIZLINK_ON_INK, BIZLINK_FONTS } from '../../lib/theme';
import { BizButton } from '../bizlink/BizButton';

interface AutoCapturedPanelProps {
  loadingLocation: boolean;
  location: { lat: number; lng: number } | null;
  photoUri: string | null;
  onOpenCamera: () => void;
  onPreviewPress: () => void;
}

/**
 * Record Meeting's GPS + timestamp + selfie block, extracted so
 * record.tsx (already near the 300-line file cap) stays under it.
 */
export function AutoCapturedPanel({ loadingLocation, location, photoUri, onOpenCamera, onPreviewPress }: AutoCapturedPanelProps) {
  return (
    <>
      <Text fontSize={11} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted} letterSpacing={0.5} marginTop="$4" marginBottom="$1">
        Auto-captured
      </Text>
      <YStack backgroundColor={BIZLINK_COLORS.ink} borderRadius={24} padding={16} gap="$2.5">
        <XStack alignItems="center" gap="$2">
          <Check size={14} color="#8FD7B4" strokeWidth={1.75} />
          <Text fontSize={12.5} fontFamily={BIZLINK_FONTS.semibold} color={BIZLINK_COLORS.card}>GPS</Text>
          <Text fontSize={12.5} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_ON_INK.textMuted}>
            {loadingLocation
              ? 'Capturing…'
              : location
                ? `${location.lat.toFixed(4)}° N, ${location.lng.toFixed(4)}° E (at capture)`
                : 'Not captured'}
          </Text>
        </XStack>
        <XStack alignItems="center" gap="$2">
          <Check size={14} color="#8FD7B4" strokeWidth={1.75} />
          <Text fontSize={12.5} fontFamily={BIZLINK_FONTS.semibold} color={BIZLINK_COLORS.card}>Date & time</Text>
          <Text fontSize={12.5} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_ON_INK.textMuted}>{new Date().toLocaleString()}</Text>
        </XStack>
        <XStack alignItems="center" gap="$3">
          {photoUri ? (
            <Pressable onPress={onPreviewPress}>
              <Image source={{ uri: photoUri }} style={{ width: 56, height: 56, borderRadius: 16 }} />
            </Pressable>
          ) : (
            <YStack width={56} height={56} borderRadius={16} backgroundColor={BIZLINK_ON_INK.circleFill} alignItems="center" justifyContent="center">
              <Camera size={20} color={BIZLINK_COLORS.card} strokeWidth={1.75} />
            </YStack>
          )}
          <YStack flex={1}>
            <Text fontSize={12} fontFamily={BIZLINK_FONTS.semibold} color={BIZLINK_COLORS.card}>Selfie — camera only</Text>
            <Text fontSize={11} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_ON_INK.textMuted}>Compressed ≤3MB · naka-save locally</Text>
            <YStack marginTop="$1.5">
              <BizButton small label={photoUri ? 'Retake' : 'Open Camera'} variant="white" onPress={onOpenCamera} />
            </YStack>
          </YStack>
        </XStack>
      </YStack>
    </>
  );
}
