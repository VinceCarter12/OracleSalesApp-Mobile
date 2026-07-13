import { useState } from 'react';
import { Pressable } from 'react-native';
import { Lock } from 'lucide-react-native';
import { Text, View, YStack } from 'tamagui';
import { COLORS } from '../../lib/theme';

interface MoreTileProps {
  icon: React.ReactNode;
  title: string;
  subtitle?: React.ReactNode;
  locked?: boolean;
  onPress: () => void;
}

/** Wireframe .moretile — 2-column grid card with icon, title, subtitle, optional lock dot. */
export function MoreTile({ icon, title, subtitle, locked, onPress }: MoreTileProps) {
  const [pressed, setPressed] = useState(false);
  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      style={{
        flexBasis: '48%',
        borderWidth: 2,
        borderColor: COLORS.swan,
        borderBottomWidth: pressed ? 2 : 5,
        marginTop: pressed ? 3 : 0,
        borderRadius: 16,
        backgroundColor: COLORS.snow,
        padding: 14,
        position: 'relative',
      }}
    >
      {locked ? (
        <View position="absolute" top={12} right={12}>
          <Lock size={13} color={COLORS.hare} />
        </View>
      ) : null}
      <View
        width={40}
        height={40}
        borderRadius={12}
        backgroundColor={COLORS.polar}
        alignItems="center"
        justifyContent="center"
        marginBottom="$2"
      >
        {icon}
      </View>
      <Text fontWeight="800" fontSize={13.5} color={COLORS.eel}>{title}</Text>
      <YStack marginTop="$0.5">{subtitle}</YStack>
    </Pressable>
  );
}
