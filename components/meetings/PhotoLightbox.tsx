import { Image, Modal, Pressable } from 'react-native';

interface PhotoLightboxProps {
  uri: string | null;
  visible: boolean;
  onClose: () => void;
}

/**
 * Full-screen tap-to-expand preview for a captured photo (selfie / end
 * photo) — shared by `PhotoCapture` and Record Meeting's own inline selfie
 * thumbnail so the modal JSX isn't duplicated. Transparent `Modal` + dark
 * backdrop, tap anywhere to close, `resizeMode="contain"` (no crop).
 */
export function PhotoLightbox({ uri, visible, onClose }: PhotoLightboxProps) {
  if (!uri) return null;
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable
        onPress={onClose}
        style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', alignItems: 'center', justifyContent: 'center' }}
      >
        <Image source={{ uri }} style={{ width: '92%', height: '70%' }} resizeMode="contain" />
      </Pressable>
    </Modal>
  );
}
