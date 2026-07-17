import { Pressable } from 'react-native';
import { LockOpen } from 'lucide-react-native';
import { View } from 'tamagui';
import { BIZLINK_COLORS } from '../../lib/theme';
import { useGate } from '../../lib/gate-context';

/** T-014 Phase 2 (ADR-024): BizLink `.lockbtn` — white circle re-lock control. Replaces `LockButton` within `app/(tabs)`. */
export function BizLockButton() {
  const { relock } = useGate();
  return (
    <Pressable onPress={relock} hitSlop={6}>
      <View
        width={44}
        height={44}
        borderRadius={22}
        backgroundColor={BIZLINK_COLORS.card}
        alignItems="center"
        justifyContent="center"
      >
        <LockOpen size={17} color={BIZLINK_COLORS.text} strokeWidth={1.75} />
      </View>
    </Pressable>
  );
}
