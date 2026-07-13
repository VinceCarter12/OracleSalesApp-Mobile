import { Pressable } from 'react-native';
import { router } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';
import { Text, XStack } from 'tamagui';
import { COLORS } from '../../lib/theme';

interface TopBarProps {
  title: string;
  right?: React.ReactNode;
}

/** Wireframe .topbar — circular back button + 18px 800-weight title. */
export function TopBar({ title, right }: TopBarProps) {
  return (
    <XStack alignItems="center" gap="$2.5" paddingHorizontal="$4" paddingVertical="$2.5">
      <Pressable
        onPress={() => router.back()}
        style={{
          width: 38,
          height: 38,
          borderRadius: 19,
          backgroundColor: COLORS.polar,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <ArrowLeft size={18} color={COLORS.eel} />
      </Pressable>
      <Text fontSize={18} fontWeight="800" letterSpacing={-0.4} color={COLORS.eel}>
        {title}
      </Text>
      {right ? <XStack marginLeft="auto">{right}</XStack> : null}
    </XStack>
  );
}
