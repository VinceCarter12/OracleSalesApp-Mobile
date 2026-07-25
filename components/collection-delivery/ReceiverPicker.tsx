import { Pressable } from 'react-native';
import { Check } from 'lucide-react-native';
import { Text, XStack, YStack } from 'tamagui';
import { useBizlinkColors, BIZLINK_FONTS, BIZLINK_ON_INK } from '../../lib/theme';
import { Avatar } from '../ui/Avatar';
import { REMIT_RECEIVERS, type RemitReceiver } from '../../lib/collection-delivery-data';

interface ReceiverPickerProps {
  selectedId: number | null;
  onSelect: (receiver: RemitReceiver) => void;
}

/** F-007: wireframe `c-receiverList`/`d-receiverList` — assigned office receivers, single-select with a check circle. */
export function ReceiverPicker({ selectedId, onSelect }: ReceiverPickerProps) {
  const BIZLINK_COLORS = useBizlinkColors();
  return (
    <YStack>
      {REMIT_RECEIVERS.map((receiver) => {
        const selected = receiver.id === selectedId;
        return (
          <Pressable key={receiver.id} onPress={() => onSelect(receiver)}>
            <XStack
              alignItems="center"
              gap="$3"
              backgroundColor={BIZLINK_COLORS.card}
              borderRadius={20}
              paddingHorizontal={15}
              paddingVertical={13}
              marginBottom={10}
            >
              <Avatar initials={receiver.initials} size="sm" background={BIZLINK_COLORS.tintA} color={BIZLINK_COLORS.ink} />
              <YStack flex={1} gap="$0.5">
                <Text fontFamily={BIZLINK_FONTS.semibold} fontSize={13.5} color={BIZLINK_COLORS.text}>{receiver.name}</Text>
                <Text fontSize={10.5} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted}>{receiver.role}</Text>
              </YStack>
              <YStack
                width={24}
                height={24}
                borderRadius={12}
                backgroundColor={selected ? BIZLINK_COLORS.brand : BIZLINK_COLORS.soft}
                alignItems="center"
                justifyContent="center"
              >
                <Check size={12} color={selected ? BIZLINK_ON_INK.solid : BIZLINK_COLORS.muted} strokeWidth={2.5} />
              </YStack>
            </XStack>
          </Pressable>
        );
      })}
    </YStack>
  );
}
