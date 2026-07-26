import { Pressable } from 'react-native';
import { Text, View, YStack } from 'tamagui';
import { BIZLINK_COLORS, BIZLINK_FONTS } from '../../lib/theme';

interface BizMoreTileProps {
  icon: React.ReactNode;
  title: string;
  subtitle?: React.ReactNode;
  locked?: boolean;
  onPress: () => void;
}

/** T-014 Phase 2 (ADR-024): BizLink `.moretile` — borderless card grid item. Replaces `MoreTile` within `app/(tabs)`. */
export function BizMoreTile({ icon, title, subtitle, locked, onPress }: BizMoreTileProps) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        flexBasis: '48%',
        borderRadius: 24,
        backgroundColor: BIZLINK_COLORS.card,
        padding: 18,
        position: 'relative',
        minHeight: 44,
      }}
    >
      <View
        width={42}
        height={42}
        borderRadius={14}
        backgroundColor={BIZLINK_COLORS.tintA}
        alignItems="center"
        justifyContent="center"
        marginBottom="$2"
      >
        {icon}
      </View>
      <Text fontSize={13.5} fontFamily={BIZLINK_FONTS.semibold} color={BIZLINK_COLORS.text}>{title}</Text>
      <YStack marginTop="$0.5">{subtitle}</YStack>
    </Pressable>
  );
}
