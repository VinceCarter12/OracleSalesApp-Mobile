import { router } from 'expo-router';
import { Timer } from 'lucide-react-native';
import { useBizlinkColors } from '../../lib/theme';
import { useClientFlowRoutes } from '../../lib/use-role-routes';
import type { ActiveMeetingDraft } from '../../lib/use-active-meeting-drafts';
import { BizDashboardAlert } from '../bizlink/BizDashboardAlert';

interface ActiveMeetingDashboardAlertProps {
  activeMeetingDrafts: ActiveMeetingDraft[];
}

/**
 * Vince 2026-08-04 direction: "meeting in progress" is always live in
 * meeting_drafts (survives navigation/backgrounding/app kill —
 * lib/meeting-drafts.ts), but had no visibility outside that one client's
 * own screen. Split out of app/(tabs)/index.tsx to keep that file under the
 * 300-line limit. Only the most-recently-started draft is shown even if more
 * than one exists (rare edge — same-day multi-client Start without
 * finishing).
 */
export function ActiveMeetingDashboardAlert({ activeMeetingDrafts }: ActiveMeetingDashboardAlertProps) {
  const BIZLINK_COLORS = useBizlinkColors();
  const routes = useClientFlowRoutes();
  if (activeMeetingDrafts.length === 0) return null;

  const { draft, client } = activeMeetingDrafts[0];
  return (
    <BizDashboardAlert
      tone="green"
      icon={<Timer size={18} color={BIZLINK_COLORS.ink} strokeWidth={1.75} />}
      title={`Meeting in progress — ${client.company_name}`}
      caption={`Nagsimula ${new Date(draft.payload.capturedAt).toLocaleTimeString()} — i-tap para ipagpatuloy`}
      onPress={() => router.push(draft.flow === 'full' ? routes.recordMeeting(client.id) : routes.recordVisit(client.id))}
    />
  );
}
