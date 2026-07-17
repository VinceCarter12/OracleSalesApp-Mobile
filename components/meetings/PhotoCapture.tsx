import { useState } from 'react';
import { Alert, Image } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Spinner, Text, YStack } from 'tamagui';
import { captureGps } from '../../lib/gps';
import { BIZLINK_COLORS, BIZLINK_FONTS } from '../../lib/theme';
import { BizButton } from '../bizlink/BizButton';

export interface CapturedPhoto {
  uri: string;
  /** ISO timestamp bound at shutter press of the FINAL confirmed capture (ADR-015). */
  capturedAt: string;
  gpsLat: number;
  gpsLng: number;
}

interface PhotoCaptureProps {
  label: string;
  captureButtonLabel: string;
  confirmButtonLabel: string;
  /** Fires once the photo is confirmed — after this the photo is locked. */
  onConfirm: (photo: CapturedPhoto) => void;
  /** Gates the initial capture button (e.g. Wireframe's agenda-gate on End Photo, `#a-visitEndBtn disabled`). Defaults to enabled. */
  disabled?: boolean;
}

async function takePhotoWithGps(): Promise<CapturedPhoto | null> {
  const camera = await ImagePicker.requestCameraPermissionsAsync();
  if (camera.status !== 'granted') {
    Alert.alert('Permission denied', 'Camera permission is required.');
    return null;
  }
  // Camera only — no gallery (F-010/ADR-008).
  const result = await ImagePicker.launchCameraAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    quality: 0.7,
    allowsEditing: false,
  });
  if (result.canceled || result.assets.length === 0) return null;
  try {
    const gps = await captureGps();
    return {
      uri: result.assets[0].uri,
      capturedAt: new Date().toISOString(),
      gpsLat: gps.lat,
      gpsLng: gps.lng,
    };
  } catch (err) {
    Alert.alert('Location Error', err instanceof Error ? err.message : 'Failed to get GPS location.');
    return null;
  }
}

/**
 * Camera-only photo capture with preview → retake/confirm → lock semantics
 * (ADR-015). GPS + timestamp are bound at shutter time; a retake replaces
 * both. Once confirmed, the photo can no longer change.
 */
export function PhotoCapture({
  label,
  captureButtonLabel,
  confirmButtonLabel,
  onConfirm,
  disabled = false,
}: PhotoCaptureProps) {
  const [photo, setPhoto] = useState<CapturedPhoto | null>(null);
  const [busy, setBusy] = useState(false);
  const [locked, setLocked] = useState(false);

  async function capture(): Promise<void> {
    setBusy(true);
    const captured = await takePhotoWithGps();
    if (captured) setPhoto(captured);
    setBusy(false);
  }

  function confirm(): void {
    if (!photo) return;
    setLocked(true);
    onConfirm(photo);
  }

  if (locked && photo) {
    return (
      <YStack gap="$2">
        <Text fontSize={13.5} color={BIZLINK_COLORS.brand} fontFamily={BIZLINK_FONTS.semibold}>
          ✓ {label} locked — {new Date(photo.capturedAt).toLocaleTimeString()}
        </Text>
      </YStack>
    );
  }

  return (
    <YStack gap="$2">
      <Text fontSize={13.5} fontFamily={BIZLINK_FONTS.semibold} color={BIZLINK_COLORS.text}>{label}</Text>
      {photo ? (
        <YStack gap="$2">
          <Image
            source={{ uri: photo.uri }}
            style={{ width: '100%', height: 200, borderRadius: 20 }}
            resizeMode="cover"
          />
          <Text fontSize={12} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted}>
            GPS {photo.gpsLat.toFixed(4)}, {photo.gpsLng.toFixed(4)} ·{' '}
            {new Date(photo.capturedAt).toLocaleTimeString()}
          </Text>
          <BizButton label="Retake (resets timestamp)" variant="white" small onPress={capture} disabled={busy} />
          <BizButton label={confirmButtonLabel} variant="brand" onPress={confirm} />
          <Text fontSize={12} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted}>
            Once confirmed, the photo and timestamp are locked.
          </Text>
        </YStack>
      ) : (
        <BizButton
          label={busy ? 'Opening camera…' : captureButtonLabel}
          variant="brand"
          onPress={capture}
          disabled={busy || disabled}
          icon={busy ? <Spinner color={BIZLINK_COLORS.card} /> : undefined}
        />
      )}
    </YStack>
  );
}
