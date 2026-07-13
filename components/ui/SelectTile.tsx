import { useState } from 'react';
import { Pressable } from 'react-native';
import { Text, XStack } from 'tamagui';
import { COLORS } from '../../lib/theme';

type TileTone = 'default' | 'ok' | 'lost';

const SELECTED_TONES: Record<TileTone, { background: string; border: string; color: string }> = {
  default: { background: COLORS.blueSoft, border: COLORS.blueBorder, color: COLORS.blue },
  ok: { background: COLORS.greenSoft, border: COLORS.feather, color: COLORS.ledgeGreen },
  lost: { background: COLORS.redSoft, border: COLORS.red, color: COLORS.ledgeRed },
};

interface SelectTileProps {
  label: string;
  selected: boolean;
  onPress: () => void;
  tone?: TileTone;
  icon?: React.ReactNode;
  fullWidth?: boolean;
}

/** Wireframe .tile — bordered chip with 3D shadow, .sel state per tone. */
export function SelectTile({
  label,
  selected,
  onPress,
  tone = 'default',
  icon,
  fullWidth = false,
}: SelectTileProps) {
  const [pressed, setPressed] = useState(false);
  const sel = SELECTED_TONES[tone];
  const background = selected ? sel.background : COLORS.snow;
  const border = selected ? sel.border : COLORS.swan;
  const color = selected ? sel.color : COLORS.eel;

  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      style={{
        borderWidth: 2,
        borderColor: border,
        borderBottomWidth: pressed ? 2 : 4,
        marginTop: pressed ? 2 : 0,
        backgroundColor: background,
        borderRadius: 12,
        paddingHorizontal: 13,
        paddingVertical: 9,
        alignSelf: fullWidth ? 'stretch' : 'flex-start',
      }}
    >
      <XStack gap="$1.5" alignItems="center">
        {icon}
        <Text fontWeight="700" fontSize={12.5} color={color}>{label}</Text>
      </XStack>
    </Pressable>
  );
}
