import { Pressable } from 'react-native';
import { LockOpen } from 'lucide-react-native';
import { View } from 'tamagui';
import { COLORS } from '../../lib/theme';
import { useGate } from '../../lib/gate-context';

/** Wireframe .lockbtn — re-locks sensitive Clients/Meetings sections on tap. */
export function LockButton() {
  const { relock } = useGate();
  return (
    <Pressable onPress={relock}>
      <View
        width={40}
        height={40}
        borderRadius={20}
        backgroundColor={COLORS.polar}
        alignItems="center"
        justifyContent="center"
      >
        <LockOpen size={17} color={COLORS.eel} />
      </View>
    </Pressable>
  );
}
