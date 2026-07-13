import { Text, View, XStack, YStack } from 'tamagui';
import { COLORS } from '../../lib/theme';

interface QuickAction {
  key: string;
  label: string;
  icon: React.ReactNode;
  badgeCount?: number;
  onPress: () => void;
}

interface QuickActionsGridProps {
  actions: QuickAction[];
}

export function QuickActionsGrid({ actions }: QuickActionsGridProps) {
  const rows = [actions.slice(0, 2), actions.slice(2, 4)];

  return (
    <YStack gap="$2.5">
      {rows.map((row, i) => (
        <XStack key={i} gap="$2.5">
          {row.map((action) => (
            <YStack
              key={action.key}
              flex={1}
              position="relative"
              backgroundColor={COLORS.snow}
              borderWidth={2}
              borderColor={COLORS.swan}
              borderRadius={14}
              paddingVertical={12}
              alignItems="center"
              gap="$1.5"
              onPress={action.onPress}
              pressStyle={{ opacity: 0.8 }}
            >
              {action.badgeCount ? (
                <View
                  position="absolute"
                  top={4}
                  right={14}
                  backgroundColor={COLORS.red}
                  borderRadius={999}
                  paddingHorizontal={5}
                  minWidth={15}
                  alignItems="center"
                >
                  <Text fontSize={9.5} fontWeight="800" color={COLORS.snow}>
                    {action.badgeCount}
                  </Text>
                </View>
              ) : null}
              <View width={36} height={36} borderRadius={18} alignItems="center" justifyContent="center" backgroundColor={COLORS.greenTint}>
                {action.icon}
              </View>
              <Text fontSize={10} fontWeight="800" color={COLORS.eel}>
                {action.label}
              </Text>
            </YStack>
          ))}
        </XStack>
      ))}
    </YStack>
  );
}
