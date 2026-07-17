import { Map } from 'lucide-react-native';
import { BIZLINK_COLORS } from '../../../lib/theme';
import { BizPlaceholderNotice } from '../../../components/bizlink/BizPlaceholderNotice';

/** Wireframe a-maps — agent-side maps removed per June 24 meeting; admin/web dashboard owns this. */
export default function AgentMapsScreen() {
  return (
    <BizPlaceholderNotice
      screenTitle="Maps"
      icon={<Map size={40} color={BIZLINK_COLORS.muted} strokeWidth={1.75} />}
      body="Per June 24 meeting, tinanggal ang maps sa mobile agent side — admin/web dashboard lang ang may plano nito."
    />
  );
}
