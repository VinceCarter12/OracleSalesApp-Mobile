import { Pressable } from 'react-native';
import { Check } from 'lucide-react-native';
import { Text, XStack, YStack } from 'tamagui';
import { useBizlinkColors, BIZLINK_FONTS, BIZLINK_ON_INK } from '../../lib/theme';
import { Avatar } from '../ui/Avatar';
import { type RemitReceiver } from '../../lib/collection-delivery-data';

interface ReceiverPickerProps {
  /** The real module-admin receivers (resolved live — see useRemitReceivers). */
  receivers: RemitReceiver[];
  selectedId: string | null;
  onSelect: (receiver: RemitReceiver) => void;
  /** True while the admin accounts are still being fetched (online read). */
  loading?: boolean;
  /** True if the fetch failed (e.g. offline). Offers a retry. */
  error?: boolean;
  onRetry?: () => void;
}

/** F-007: wireframe `c-receiverList`/`d-receiverList` — assigned office receivers, single-select with a check circle. */
export function ReceiverPicker({ receivers, selectedId, onSelect, loading, error, onRetry }: ReceiverPickerProps) {
  const BIZLINK_COLORS = useBizlinkColors();

  // The receiver is the real module admin, loaded online. Cover the not-ready
  // states so the collector/driver understands why no one is listed yet.
  if (receivers.length === 0) {
    const message = loading
      ? 'Loading the assigned receiver…'
      : error
        ? 'Couldn’t load the assigned receiver — check your connection.'
        : 'No admin is assigned to receive this module’s remittance yet.';
    return (
      <YStack backgroundColor={BIZLINK_COLORS.card} borderRadius={20} paddingHorizontal={15} paddingVertical={16} gap="$2">
        <Text fontSize={12.5} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted} lineHeight={18}>
          {message}
        </Text>
        {error && onRetry ? (
          <Pressable onPress={onRetry} hitSlop={6}>
            <Text fontSize={12.5} fontFamily={BIZLINK_FONTS.semibold} color={BIZLINK_COLORS.brand}>Try again</Text>
          </Pressable>
        ) : null}
      </YStack>
    );
  }

  return (
    <YStack>
      {receivers.map((receiver) => {
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
