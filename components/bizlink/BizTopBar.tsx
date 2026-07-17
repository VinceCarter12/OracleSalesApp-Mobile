import { Pressable } from 'react-native';
import { router } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';
import { Text, XStack } from 'tamagui';
import { BIZLINK_COLORS, BIZLINK_FONTS } from '../../lib/theme';

interface BizTopBarProps {
  title: string;
  right?: React.ReactNode;
}

/**
 * T-014 Phase 2 (ADR-024): BizLink `.topbar` — white circular back button
 * (44x44dp touch target) + General Sans title. Scoped to `app/(tabs)` for
 * this phase — see `components/ui/TopBar.tsx` for the Manager/Executive
 * equivalent (out of scope, unchanged).
 */
export function BizTopBar({ title, right }: BizTopBarProps) {
  return (
    <XStack alignItems="center" gap="$2.5" paddingHorizontal="$4" paddingVertical="$2.5">
      <Pressable
        onPress={() => router.back()}
        hitSlop={6}
        style={{
          width: 44,
          height: 44,
          borderRadius: 22,
          backgroundColor: BIZLINK_COLORS.card,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <ArrowLeft size={18} color={BIZLINK_COLORS.text} strokeWidth={1.75} />
      </Pressable>
      <Text fontSize={19} fontFamily={BIZLINK_FONTS.semibold} color={BIZLINK_COLORS.text}>
        {title}
      </Text>
      {right ? <XStack marginLeft="auto">{right}</XStack> : null}
    </XStack>
  );
}
