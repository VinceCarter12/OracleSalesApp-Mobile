import { Map } from 'lucide-react-native';
import { COLORS } from '../../../lib/theme';
import { PlaceholderNotice } from '../../../components/ui/PlaceholderNotice';

/** Wireframe a-maps — agent-side maps removed per June 24 meeting; admin/web dashboard owns this. */
export default function AgentMapsScreen() {
  return (
    <PlaceholderNotice
      screenTitle="Maps"
      icon={<Map size={40} color={COLORS.hare} />}
      body="Per June 24 meeting, tinanggal ang maps sa mobile agent side — admin/web dashboard lang ang may plano nito."
    />
  );
}
