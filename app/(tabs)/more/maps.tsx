import { Hourglass, Map } from 'lucide-react-native';
import { Text, YStack } from 'tamagui';
import { COLORS } from '../../../lib/theme';
import { TopBar } from '../../../components/ui/TopBar';

/** Wireframe a-maps — agent-side maps removed per June 24 meeting; admin/web dashboard owns this. */
export default function AgentMapsScreen() {
  return (
    <YStack flex={1} backgroundColor={COLORS.snow}>
      <TopBar title="Maps" />
      <YStack flex={1} alignItems="center" justifyContent="center" paddingHorizontal="$6" gap="$3">
        <Map size={40} color={COLORS.hare} />
        <Text fontWeight="800" fontSize={14} color={COLORS.eel} textAlign="center">
          Hindi pa final ang feature na ito
        </Text>
        <Text fontSize={13} fontWeight="600" color={COLORS.hare} textAlign="center" lineHeight={19}>
          Per June 24 meeting, tinanggal ang maps sa mobile agent side — admin/web dashboard lang
          ang may plano nito.
        </Text>
        <YStack flexDirection="row" alignItems="center" gap="$1.5" marginTop="$1">
          <Hourglass size={14} color={COLORS.orange} />
          <Text fontWeight="800" fontSize={12.5} color={COLORS.orange}>Pending client confirmation</Text>
        </YStack>
      </YStack>
    </YStack>
  );
}
