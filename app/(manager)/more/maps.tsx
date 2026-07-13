import { Hourglass, Map } from 'lucide-react-native';
import { Text, YStack } from 'tamagui';
import { COLORS } from '../../../lib/theme';
import { TopBar } from '../../../components/ui/TopBar';

/** Wireframe s-maps — placeholder, pending client confirmation per June 24 + Jul 10 meetings. */
export default function ManagerMapsScreen() {
  return (
    <YStack flex={1} backgroundColor={COLORS.snow}>
      <TopBar title="Maps" />
      <YStack flex={1} alignItems="center" justifyContent="center" paddingHorizontal="$6" gap="$3">
        <Map size={40} color={COLORS.hare} />
        <Text fontWeight="800" fontSize={14} color={COLORS.eel} textAlign="center">
          Hindi pa final ang feature na ito
        </Text>
        <Text fontSize={13} fontWeight="600" color={COLORS.hare} textAlign="center" lineHeight={19}>
          Per June 24 meeting, ang maps ay tinanggal sa mobile agent side — web dashboard (Manager/Admin) ang may
          hawak nito para sa pag-verify ng meeting locations.{'\n\n'}
          Update Jul 10: gusto ng client na may mukha ng handling agent ang map pins ("legend") — web-side ito at kay
          Guanez ang implementation, hindi sa mobile repo. Tandaan din (ADR-012): ang GPS ng online meetings ay
          lokasyon ng agent, hindi ng client — hindi dapat i-plot bilang client-site visit.
        </Text>
        <YStack flexDirection="row" alignItems="center" gap="$1.5">
          <Hourglass size={13} color={COLORS.orange} />
          <Text fontSize={12.5} fontWeight="800" color={COLORS.orange}>Pending client confirmation</Text>
        </YStack>
      </YStack>
    </YStack>
  );
}
