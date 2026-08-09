import { useState } from 'react';
import { Image, Modal, Pressable, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { X } from 'lucide-react-native';
import { YStack, XStack } from 'tamagui';
import { useBizlinkColors } from '../../lib/theme';

interface ImagePreviewModalProps {
  visible: boolean;
  imageUrl: string | null;
  onClose: () => void;
}

export function ImagePreviewModal({ visible, imageUrl, onClose }: ImagePreviewModalProps) {
  const BIZLINK_COLORS = useBizlinkColors();
  const insets = useSafeAreaInsets();

  if (!imageUrl) return null;

  return (
    <Modal visible={visible} transparent animationType="fade">
      <YStack
        flex={1}
        backgroundColor="rgba(0, 0, 0, 0.8)"
        paddingTop={insets.top}
        paddingBottom={insets.bottom}
      >
        <XStack justifyContent="space-between" alignItems="center" paddingHorizontal={16} paddingVertical={12}>
          <YStack width={32} />
          <Pressable onPress={onClose}>
            <X size={28} color="white" strokeWidth={2} />
          </Pressable>
        </XStack>

        <ScrollView
          contentContainerStyle={{
            flex: 1,
            justifyContent: 'center',
            alignItems: 'center',
            paddingHorizontal: 16,
          }}
          scrollEnabled
        >
          <Image
            source={{ uri: imageUrl }}
            style={{
              width: '100%',
              height: undefined,
              aspectRatio: 1,
              borderRadius: 16,
            }}
          />
        </ScrollView>
      </YStack>
    </Modal>
  );
}
