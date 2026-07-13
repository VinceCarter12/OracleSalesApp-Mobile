import { Text, View, YStack } from 'tamagui';
import { COLORS } from '../../lib/theme';

interface StatCardProps {
  icon: React.ReactNode;
  iconBackground: string;
  value: number | string;
  label: string;
  delta: string;
  deltaTone?: 'up' | 'warn';
  onPress?: () => void;
}

export function StatCard({ icon, iconBackground, value, label, delta, deltaTone = 'up', onPress }: StatCardProps) {
  return (
    <YStack
      onPress={onPress}
      minWidth={132}
      backgroundColor={COLORS.snow}
      borderWidth={2}
      borderColor={COLORS.swan}
      borderRadius={16}
      padding="$3"
      pressStyle={{ opacity: 0.85 }}
    >
      <View
        width={32}
        height={32}
        borderRadius={10}
        alignItems="center"
        justifyContent="center"
        marginBottom="$2"
        backgroundColor={iconBackground}
      >
        {icon}
      </View>
      <Text fontSize={24} fontWeight="800" letterSpacing={-0.5} color={COLORS.eel}>
        {value}
      </Text>
      <Text fontSize={11.5} fontWeight="700" color={COLORS.wolf} marginTop={2} marginBottom={4}>
        {label}
      </Text>
      <Text fontSize={10.5} fontWeight="800" color={deltaTone === 'up' ? COLORS.ledgeGreen : COLORS.orange}>
        {delta}
      </Text>
    </YStack>
  );
}
