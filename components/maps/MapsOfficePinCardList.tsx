import { Pressable } from 'react-native';
import { Text, View, XStack, YStack } from 'tamagui';
import { BIZLINK_COLORS, BIZLINK_FONTS } from '../../lib/theme';
import type { OfficePinClient } from '../../lib/use-office-pins';

interface MapsOfficePinCardListProps {
  pins: OfficePinClient[];
  startIndex: number;
  selectedMarkerIds: Set<string>;
  onCardPress: (pinId: string) => void;
}

/** Office-pin card list rendered in place of the meetings list when the Maps
 * Meeting Type filter is 'Client Office' (office-only view). Mirror of
 * MapsMeetingCardList: tapping a card toggles its `office:<id>` marker
 * highlight on the map. Verified pins use brand/green, unverified use
 * orange — same color language as the office pins on the Leaflet map.
 */
export function MapsOfficePinCardList({ pins, startIndex, selectedMarkerIds, onCardPress }: MapsOfficePinCardListProps) {
  return (
    <YStack gap="$2">
      {pins.map((pin, index) => {
        const globalIndex = startIndex + index + 1;
        const markerId = `office:${pin.id}`;
        const isSelected = selectedMarkerIds.has(markerId);

        return (
          <Pressable key={pin.id} onPress={() => onCardPress(pin.id)}>
            <View
              backgroundColor={isSelected ? BIZLINK_COLORS.soft : BIZLINK_COLORS.card}
              borderRadius={20}
              padding={14}
              borderWidth={isSelected ? 2 : 0}
              borderColor={BIZLINK_COLORS.brand}
            >
              <XStack gap="$3" alignItems="center">
                <View
                  width={36}
                  height={36}
                  borderRadius={18}
                  backgroundColor={pin.verified ? BIZLINK_COLORS.brand : BIZLINK_COLORS.orange}
                  alignItems="center"
                  justifyContent="center"
                >
                  <Text fontSize={16} fontFamily={BIZLINK_FONTS.semibold} color="#FFFFFF">
                    {globalIndex}
                  </Text>
                </View>
                <YStack flex={1} gap="$1">
                  <Text fontSize={14} fontFamily={BIZLINK_FONTS.semibold} color={BIZLINK_COLORS.text}>
                    {pin.companyName}
                  </Text>
                  <Text fontSize={12} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted}>
                    {pin.verified ? 'Verified office location' : 'Unverified office location'}
                  </Text>
                </YStack>
              </XStack>
            </View>
          </Pressable>
        );
      })}
    </YStack>
  );
}