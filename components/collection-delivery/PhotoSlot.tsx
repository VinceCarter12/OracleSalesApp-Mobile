import { useState } from 'react';
import { Alert, Image, Pressable } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Camera } from 'lucide-react-native';
import { Spinner, Text, XStack, YStack } from 'tamagui';
import { useBizlinkColors, BIZLINK_FONTS, COLORS } from '../../lib/theme';

interface PhotoSlotProps {
  /** Empty-state title, e.g. "Take a photo of the signed acknowledgment". */
  title: string;
  subtitle: string;
  uri: string | null;
  onCaptured: (uri: string) => void;
}

/**
 * F-007: wireframe `.photoslot` — dashed tap-to-capture card that fills with
 * a thumbnail once a photo is taken. Camera only, no gallery (F-010/ADR-008
 * applies to Collection/Delivery proof photos too — every wireframe slot says
 * "camera only"). Unlike `components/meetings/PhotoCapture.tsx` there is no
 * GPS binding or confirm-lock here — remit proof is a single shot, retake by
 * tapping again.
 */
export function PhotoSlot({ title, subtitle, uri, onCaptured }: PhotoSlotProps) {
  const BIZLINK_COLORS = useBizlinkColors();
  const [busy, setBusy] = useState(false);

  async function capture(): Promise<void> {
    setBusy(true);
    try {
      const camera = await ImagePicker.requestCameraPermissionsAsync();
      if (camera.status !== 'granted') {
        Alert.alert('Permission denied', 'Camera permission is required.');
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.7,
        allowsEditing: false,
      });
      if (!result.canceled && result.assets.length > 0) onCaptured(result.assets[0].uri);
    } finally {
      setBusy(false);
    }
  }

  const filled = !!uri;
  return (
    <Pressable onPress={capture} disabled={busy}>
      <XStack
        alignItems="center"
        gap="$3"
        backgroundColor={filled ? BIZLINK_COLORS.tintA : BIZLINK_COLORS.card}
        borderRadius={20}
        borderWidth={filled ? 0 : 1.5}
        borderColor={COLORS.swanLedge}
        borderStyle={filled ? 'solid' : 'dashed'}
        paddingHorizontal={15}
        paddingVertical={13}
        marginTop={8}
      >
        {filled ? (
          <Image source={{ uri: uri! }} style={{ width: 48, height: 48, borderRadius: 14 }} resizeMode="cover" />
        ) : (
          <YStack width={48} height={48} borderRadius={14} backgroundColor={BIZLINK_COLORS.soft} alignItems="center" justifyContent="center">
            {busy ? <Spinner size="small" color={BIZLINK_COLORS.brand} /> : <Camera size={19} color={BIZLINK_COLORS.muted} strokeWidth={1.75} />}
          </YStack>
        )}
        <YStack flex={1} gap="$0.5">
          <Text fontSize={12.5} fontFamily={BIZLINK_FONTS.semibold} color={BIZLINK_COLORS.text}>
            {filled ? '✓ Photo captured' : title}
          </Text>
          <Text fontSize={10.5} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted}>
            {filled ? 'Tap to retake' : subtitle}
          </Text>
        </YStack>
      </XStack>
    </Pressable>
  );
}
