import { useState } from 'react';
import { Alert, Image } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { Button, Spinner, Text, YStack } from 'tamagui';
import { COLORS } from '../../lib/theme';

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
}

async function takePhotoWithGps(): Promise<CapturedPhoto | null> {
  const camera = await ImagePicker.requestCameraPermissionsAsync();
  if (camera.status !== 'granted') {
    Alert.alert('Permission denied', 'Camera permission is required.');
    return null;
  }
  const gps = await Location.requestForegroundPermissionsAsync();
  if (gps.status !== 'granted') {
    Alert.alert('Permission denied', 'Location permission is required — GPS is bound to every photo.');
    return null;
  }
  // Camera only — no gallery (F-010/ADR-008).
  const result = await ImagePicker.launchCameraAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    quality: 0.7,
    allowsEditing: false,
  });
  if (result.canceled || result.assets.length === 0) return null;
  const position = await Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.High,
  });
  return {
    uri: result.assets[0].uri,
    capturedAt: new Date().toISOString(),
    gpsLat: position.coords.latitude,
    gpsLng: position.coords.longitude,
  };
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
        <Text fontSize="$3" color={COLORS.ledgeGreen} fontWeight="700">
          ✓ {label} locked — {new Date(photo.capturedAt).toLocaleTimeString()}
        </Text>
      </YStack>
    );
  }

  return (
    <YStack gap="$2">
      <Text fontSize="$3" fontWeight="600">{label}</Text>
      {photo ? (
        <YStack gap="$2">
          <Image
            source={{ uri: photo.uri }}
            style={{ width: '100%', height: 200, borderRadius: 8 }}
            resizeMode="cover"
          />
          <Text fontSize="$2" color="$colorPress">
            GPS {photo.gpsLat.toFixed(4)}, {photo.gpsLng.toFixed(4)} ·{' '}
            {new Date(photo.capturedAt).toLocaleTimeString()}
          </Text>
          <Button size="$3" onPress={capture} disabled={busy}>
            Retake (resets timestamp)
          </Button>
          <Button size="$4" theme="active" onPress={confirm}>
            {confirmButtonLabel}
          </Button>
          <Text fontSize="$2" color="$colorPress">
            Once confirmed, the photo and timestamp are locked.
          </Text>
        </YStack>
      ) : (
        <Button size="$4" theme="active" onPress={capture} disabled={busy} icon={busy ? <Spinner /> : undefined}>
          {busy ? 'Opening camera…' : captureButtonLabel}
        </Button>
      )}
    </YStack>
  );
}
