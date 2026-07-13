import { useState } from 'react';
import { Pressable } from 'react-native';
import { Text, View } from 'tamagui';
import { COLORS } from '../../lib/theme';

interface QuickActionProps {
  icon: React.ReactNode;
  label: string;
  onPress: () => void;
}

/** Wireframe .qa button — bordered tile with circular green-tint icon. */
export function QuickAction({ icon, label, onPress }: QuickActionProps) {
  const [pressed, setPressed] = useState(false);
  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      style={{
        width: 82,
        borderWidth: 2,
        borderColor: COLORS.swan,
        borderBottomWidth: pressed ? 2 : 4,
        marginTop: pressed ? 2 : 0,
        borderRadius: 14,
        paddingVertical: 12,
        paddingHorizontal: 4,
        alignItems: 'center',
        gap: 6,
        backgroundColor: COLORS.snow,
      }}
    >
      <View
        width={36}
        height={36}
        borderRadius={18}
        backgroundColor={COLORS.greenTint}
        alignItems="center"
        justifyContent="center"
      >
        {icon}
      </View>
      <Text fontSize={10} fontWeight="800" color={COLORS.eel} textAlign="center">
        {label}
      </Text>
    </Pressable>
  );
}
