import Svg, { Circle } from 'react-native-svg';
import { Text, View } from 'tamagui';
import { COLORS } from '../../lib/theme';

interface ProgressRingProps {
  percent: number;
  size?: number;
  /** Optional theme-reactive overrides (Design-System-Catalog §"Progress ring") — callers not yet migrated to useBizlinkColors() keep the legacy COLORS defaults below. */
  trackColor?: string;
  fillColor?: string;
  textColor?: string;
}

const STROKE_WIDTH = 7;

/** Wireframe .ring — SVG progress circle with centered percent label. */
export function ProgressRing({ percent, size = 70, trackColor, fillColor, textColor }: ProgressRingProps) {
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
          stroke={trackColor ?? '#E5E5E5'}
          strokeWidth={STROKE_WIDTH}
          fill="none"
        />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={fillColor ?? COLORS.feather}
          strokeWidth={STROKE_WIDTH}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
        />
      </Svg>
      <Text
        position="absolute"
        fontWeight="600"
        fontSize={size >= 70 ? 15 : 12}
        color={textColor ?? COLORS.eel}
      >
        {clamped}%
      </Text>
    </View>
  );
}
