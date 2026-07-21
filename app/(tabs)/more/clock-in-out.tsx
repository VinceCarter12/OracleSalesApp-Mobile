import { Clock } from 'lucide-react-native';
import { BIZLINK_COLORS } from '../../../lib/theme';
import { BizPlaceholderNotice } from '../../../components/bizlink/BizPlaceholderNotice';

/**
 * Wireframe `id="a-clockinout"` (F-006) — display-only UI concept per client
 * request 2026-07-14; F-006 itself is explicitly UNSPEC'D and out of scope
 * (Sprint.md, Features.md#F-006). No working clock-in/out logic is built
 * here — this is a placeholder, matching the wireframe's own note that it's
 * "preview lang ang screen na ito — wala pang function."
 */
export default function ClockInOutScreen() {
  return (
    <BizPlaceholderNotice
      screenTitle="Clock In/Out"
      icon={<Clock size={40} color={BIZLINK_COLORS.muted} strokeWidth={1.75} />}
      body="Office & event attendance — UI concept lang sa ngayon. Kailangan pa ng full spec (F-006) bago i-build ang totoong logic."
      badgeLabel="F-006 — needs full spec"
      fallbackHref="/(tabs)/more"
    />
  );
}
