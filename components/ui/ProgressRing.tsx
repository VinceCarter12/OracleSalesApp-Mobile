import Svg, { Circle } from 'react-native-svg';
import { Text, View } from 'tamagui';
import { COLORS } from '../../lib/theme';

interface ProgressRingProps {
  percent: number;
  size?: number;
}

const STROKE_WIDTH = 7;

/** Wireframe .ring — SVG progress circle with centered percent label. */
export function ProgressRing({ percent, size = 70 }: ProgressRingProps) {
  const radius = (size - STROKE_WIDTH * 2) / 2 + STROKE_WIDTH / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(100, percent));
  const offset = circumference - (circumference * clamped) / 100;

  return (
    <View width={size} height={size} alignItems="center" justifyContent="center">
      <Svg width={size} height={size} style={{ transform: [{ rotate: '-90deg' }] }}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="#E5E5E5"
          strokeWidth={STROKE_WIDTH}
          fill="none"
        />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={COLORS.feather}
          strokeWidth={STROKE_WIDTH}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
        />
      </Svg>
      <Text
        position="absolute"
        fontWeight="800"
        fontSize={size >= 70 ? 16 : 12}
        color={COLORS.eel}
      >
        {clamped}%
      </Text>
    </View>
  );
}
