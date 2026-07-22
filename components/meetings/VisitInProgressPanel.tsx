import { TriangleAlert } from 'lucide-react-native';
import { Spinner, Text, XStack, YStack } from 'tamagui';
import { BIZLINK_COLORS, BIZLINK_FONTS } from '../../lib/theme';
import { BizCard } from '../bizlink/BizCard';
import { BizSectionHeader } from '../bizlink/BizSectionHeader';
import { AgendaChecklist } from './AgendaChecklist';
import { PhotoCapture, type CapturedPhoto } from './PhotoCapture';

/** mm:ss, matching the wireframe's `id="a-visitElapsed"` format. */
function formatElapsed(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

interface VisitInProgressPanelProps {
  startedAt: string;
  elapsedSeconds: number;
  selectedAgendas: string[];
  onToggleAgenda: (agenda: string) => void;
  saving: boolean;
  onConfirm: (endPhoto: CapturedPhoto) => void;
}

/**
 * record-visit.tsx's in-progress section (elapsed timer + agenda checklist +
 * end-photo capture), extracted so that already-near-the-cap screen stays
 * under the 300-line file limit.
 */
export function VisitInProgressPanel({
  startedAt,
  elapsedSeconds,
  selectedAgendas,
  onToggleAgenda,
  saving,
  onConfirm,
}: VisitInProgressPanelProps) {
  return (
    <YStack marginTop="$4" gap="$4">
      <BizCard flat borderRadius={20}>
        <Text fontFamily={BIZLINK_FONTS.semibold} fontSize={14} color={BIZLINK_COLORS.ink}>Meeting in progress</Text>
        <Text fontSize={12.5} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.ink} marginTop="$1">
          Started {new Date(startedAt).toLocaleTimeString()} · {formatElapsed(elapsedSeconds)} · GPS locked
        </Text>
      </BizCard>

      <BizSectionHeader title="Agenda" helper="· piliin lahat ng na-cover" />
      <Text fontSize={12} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted} marginTop={-6} marginBottom="$2" lineHeight={17}>
        Ang "Product / company presentation" tick dito ang buong basehan ng progress % ng client — hindi na Complete Info (B-001).
      </Text>
      {selectedAgendas.length === 0 ? (
        <XStack alignItems="center" gap="$1.5" marginBottom="$2">
          <TriangleAlert size={14} color="#B4740A" strokeWidth={1.75} />
          <Text fontSize={12} fontFamily={BIZLINK_FONTS.medium} color="#B4740A" flex={1} lineHeight={16}>
            Pumili ng kahit isang agenda bago maaktibo ang "Tapusin" button.
          </Text>
        </XStack>
      ) : null}
      <AgendaChecklist selected={selectedAgendas} onToggle={onToggleAgenda} />

      {saving ? (
        <YStack alignItems="center" gap="$2.5" padding="$4">
          <Spinner size="large" color={BIZLINK_COLORS.brand} />
          <Text color={BIZLINK_COLORS.muted}>Saving meeting…</Text>
        </YStack>
      ) : (
        <PhotoCapture
          label="End Photo"
          captureButtonLabel="Finish — take END photo"
          confirmButtonLabel="Confirm — end the meeting"
          onConfirm={onConfirm}
          disabled={selectedAgendas.length === 0}
        />
      )}
    </YStack>
  );
}
