import { Pressable } from 'react-native';
import { router } from 'expo-router';
import { Text, XStack, YStack } from 'tamagui';
import { BIZLINK_COLORS, BIZLINK_FONTS } from '../../lib/theme';
import { Avatar } from '../ui/Avatar';

interface SelectedClientCardProps {
  clientName: string | null;
}

/**
 * Record Meeting's selected-company header card, extracted so record.tsx
 * (already near the 300-line file cap) stays under it.
 */
export function SelectedClientCard({ clientName }: SelectedClientCardProps) {
  return (
    <XStack
      alignItems="center"
      gap="$3"
      backgroundColor={BIZLINK_COLORS.card}
      borderRadius={20}
      padding={14}
      marginBottom="$3.5"
    >
      <Avatar
        initials={(clientName ?? '—').slice(0, 2).toUpperCase()}
        size="sm"
        background={BIZLINK_COLORS.tintA}
        color={BIZLINK_COLORS.ink}
      />
      <YStack flex={1} gap="$0.5">
        <Text fontFamily={BIZLINK_FONTS.semibold} fontSize={14} color={BIZLINK_COLORS.text}>
          {clientName ?? '—'}
        </Text>
        <Text fontSize={11.5} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted}>
          Napiling company
        </Text>
      </YStack>
      <Pressable onPress={() => router.back()} style={{ minHeight: 44, minWidth: 44, alignItems: 'center', justifyContent: 'center' }} hitSlop={8}>
        <Text fontSize={12.5} fontFamily={BIZLINK_FONTS.semibold} color={BIZLINK_COLORS.brand}>
          Palitan
        </Text>
      </Pressable>
    </XStack>
  );
}
