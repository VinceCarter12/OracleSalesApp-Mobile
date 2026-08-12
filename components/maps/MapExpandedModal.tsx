import { Modal, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { X } from 'lucide-react-native';
import { View, XStack, YStack } from 'tamagui';
import { BIZLINK_COLORS } from '../../lib/theme';
import { LeafletWebViewMapWithControls, type MapTileType, type LeafletMapMarker } from './LeafletWebViewMap';

/**
 * Full-screen map modal shared shape (Sales/RSR + Manager maps screens both
 * open the same expanded Leaflet view from a "expand" tap) — extracted out
 * of `app/(manager)/more/maps.tsx` to keep that route under this repo's
 * 300-line file limit; behavior is unchanged from what was inline before.
 */
export function MapExpandedModal({
  markers,
  selectedMarkerIds,
  tileType,
  onTileTypeChange,
  onMarkerPress,
  onClose,
}: {
  markers: LeafletMapMarker[];
  selectedMarkerIds: string[];
  tileType: MapTileType;
  onTileTypeChange: (type: MapTileType) => void;
  onMarkerPress: (id: string) => void;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible transparent animationType="fade">
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.8)' }}>
        <YStack flex={1} paddingTop={insets.top + 10} paddingBottom={insets.bottom + 10} paddingHorizontal={10}>
          <XStack justifyContent="flex-end" marginBottom={10}>
            <Pressable
              onPress={onClose}
              style={{
                width: 44,
                height: 44,
                borderRadius: 22,
                backgroundColor: BIZLINK_COLORS.card,
                justifyContent: 'center',
                alignItems: 'center',
              }}
            >
              <X size={24} color={BIZLINK_COLORS.text} strokeWidth={2} />
            </Pressable>
          </XStack>
          <YStack flex={1} borderRadius={24} overflow="hidden">
            <LeafletWebViewMapWithControls
              markers={markers}
              selectedMarkerIds={selectedMarkerIds}
              height={0}
              tileType={tileType}
              onTileTypeChange={onTileTypeChange}
              expanded
              onMarkerPress={onMarkerPress}
            />
          </YStack>
        </YStack>
      </View>
    </Modal>
  );
}
