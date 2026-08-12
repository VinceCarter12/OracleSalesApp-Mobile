import { useRef, useState } from 'react';
import { Alert, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { CameraView, useCameraPermissions, type CameraView as CameraViewType } from 'expo-camera';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Check, Flashlight, FlashlightOff, X } from 'lucide-react-native';

interface InAppCameraOverlayProps {
  visible: boolean;
  title: string;
  facing?: 'front' | 'back';
  onCancel: () => void;
  onCaptured: (uri: string, capturedAt: string) => void;
}

/** Full-screen, camera-only meeting capture. No gallery path is exposed. */
export function InAppCameraOverlay({ visible, title, facing = 'front', onCancel, onCaptured }: InAppCameraOverlayProps) {
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraViewType>(null);
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState<'off' | 'on'>('off');
  const insets = useSafeAreaInsets();

  async function openCamera(): Promise<void> {
    const result = permission?.granted ? permission : await requestPermission();
    if (!result.granted) {
      Alert.alert('Permission denied', 'Camera permission is required for meeting photos.');
      onCancel();
    }
  }

  async function shutter(): Promise<void> {
    if (busy || !cameraRef.current) return;
    setBusy(true);
    try {
      const capturedAt = new Date().toISOString();
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.7 });
      if (photo?.uri) onCaptured(photo.uri, capturedAt);
    } catch (error) {
      Alert.alert('Camera error', error instanceof Error ? error.message : 'Could not capture photo.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onShow={() => { void openCamera(); }}>
      <View style={styles.root}>
        {permission?.granted ? <CameraView ref={cameraRef} style={StyleSheet.absoluteFill} facing={facing} flash={flash} /> : null}
        <View style={[styles.top, { paddingTop: insets.top + 12 }]}>
          <Pressable accessibilityRole="button" accessibilityLabel="Close camera" onPress={onCancel} style={styles.iconButton}>
            <X color="#FFFFFF" size={24} strokeWidth={1.75} />
          </Pressable>
          <Text style={styles.title}>{title}</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={flash === 'on' ? 'Turn flash off' : 'Turn flash on'}
            onPress={() => setFlash((current) => current === 'on' ? 'off' : 'on')}
            style={styles.iconButton}
          >
            {flash === 'on' ? <Flashlight color="#FFFFFF" size={23} strokeWidth={1.75} /> : <FlashlightOff color="#FFFFFF" size={23} strokeWidth={1.75} />}
          </Pressable>
        </View>
        <View style={[styles.bottom, { paddingBottom: Math.max(insets.bottom, 16) + 12 }]}>
          <Text style={styles.helper}>Camera only · no gallery</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Take photo"
            onPress={() => { void shutter(); }}
            disabled={busy || !permission?.granted}
            style={[styles.shutter, busy && styles.shutterBusy]}
          >
            <View style={styles.shutterInner}>{busy ? null : <Check color="#005B36" size={26} strokeWidth={2} />}</View>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#071D17' },
  top: { position: 'absolute', left: 0, right: 0, top: 0, zIndex: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16 },
  title: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },
  iconButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  bottom: { position: 'absolute', left: 0, right: 0, bottom: 0, zIndex: 2, alignItems: 'center', gap: 12, backgroundColor: 'rgba(0,0,0,0.32)', paddingTop: 16 },
  helper: { color: 'rgba(255,255,255,0.82)', fontSize: 12 },
  shutter: { width: 76, height: 76, borderRadius: 38, borderWidth: 4, borderColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  shutterBusy: { opacity: 0.5 },
  shutterInner: { width: 60, height: 60, borderRadius: 30, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
});
