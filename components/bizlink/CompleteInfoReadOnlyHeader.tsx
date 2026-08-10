import { Text, View, XStack, YStack } from 'tamagui';
import { useBizlinkColors, BIZLINK_FONTS } from '../../lib/theme';

interface CompleteInfoReadOnlyHeaderProps {
  companyName: string;
  city: string | null | undefined;
}

/**
 * Complete Info's view-only Company name / City pair — set once at Create
 * Client (Phase A), not part of the wireframe's a-complete editable form.
 * Extracted from `app/(tabs)/clients/complete.tsx` to keep that file under
 * the 300-line standard.
 */
export function CompleteInfoReadOnlyHeader({ companyName, city }: CompleteInfoReadOnlyHeaderProps) {
  const BIZLINK_COLORS = useBizlinkColors();
  return (
    <XStack gap="$2.5" marginBottom="$3.5">
      <YStack flex={1} gap="$1.5">
        <Text fontSize={11} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted} letterSpacing={0.4}>
          COMPANY NAME
        </Text>
        <View
          height={52}
          borderRadius={16}
          paddingHorizontal={16}
          justifyContent="center"
          backgroundColor={BIZLINK_COLORS.canvas}
          borderWidth={1}
          borderColor={BIZLINK_COLORS.line}
        >
          <Text fontSize={14.5} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.text} numberOfLines={1}>
            {companyName}
          </Text>
        </View>
      </YStack>
      <YStack flex={1} gap="$1.5">
        <Text fontSize={11} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted} letterSpacing={0.4}>
          CITY
        </Text>
        <View
          height={52}
          borderRadius={16}
          paddingHorizontal={16}
          justifyContent="center"
          backgroundColor={BIZLINK_COLORS.canvas}
          borderWidth={1}
          borderColor={BIZLINK_COLORS.line}
        >
          <Text fontSize={14.5} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.text} numberOfLines={1}>
            {city ?? '—'}
          </Text>
        </View>
      </YStack>
    </XStack>
  );
}
