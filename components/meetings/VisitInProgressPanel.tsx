import { Info, TriangleAlert } from 'lucide-react-native';
import { Spinner, Text, XStack, YStack } from 'tamagui';
import { useBizlinkColors, BIZLINK_FONTS } from '../../lib/theme';
import { BizCard } from '../bizlink/BizCard';
import { BizSectionHeader } from '../bizlink/BizSectionHeader';
import { BizButton } from '../bizlink/BizButton';
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
  onCancel: () => void;
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
  onCancel,
}: VisitInProgressPanelProps) {
  const BIZLINK_COLORS = useBizlinkColors();
  return (
    <YStack marginTop="$4" gap="$4">
      <BizCard flat borderRadius={20}>
        <Text fontFamily={BIZLINK_FONTS.semibold} fontSize={14} color={BIZLINK_COLORS.ink}>Meeting in progress</Text>
        <Text fontSize={12.5} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.ink} marginTop="$1">
          Started {new Date(startedAt).toLocaleTimeString()} · {formatElapsed(elapsedSeconds)} · Location saved
        </Text>
      </BizCard>

      <BizSectionHeader title="Agenda" helper="· tick all that were covered" />
      <Text fontSize={12} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted} marginTop={-6} marginBottom="$2" lineHeight={17}>
        Your client's progress percentage is based on whether you tick "Product / company presentation" in
        this meeting's agenda. Completing the client's other information does not raise the percentage anymore.
      </Text>
      {/* Wireframe-Sales-BizLink.html:789 (`#a-recordvisit`'s in-progress
          agenda helper) — service/relationship agendas here don't move the
          client's lifecycle stage, and tag-along gating only affects
          reporting/quota validity, never blocks offline recording. */}
      <XStack alignItems="flex-start" gap="$1.5" marginTop={-6} marginBottom="$2">
        <Info size={13} color={BIZLINK_COLORS.muted} strokeWidth={1.75} style={{ marginTop: 2 }} />
        <Text fontSize={12} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted} flex={1} lineHeight={17}>
          These are service and relationship topics for New/Existing clients. They don't change the client's
          stage. If a manager hasn't accepted your visit invite yet, the visit waits for their approval; if the
          invite was to a teammate only, the visit counts right away.
        </Text>
      </XStack>
      {selectedAgendas.length === 0 ? (
        <XStack alignItems="center" gap="$1.5" marginBottom="$2">
          <TriangleAlert size={14} color="#B4740A" strokeWidth={1.75} />
          <Text fontSize={12} fontFamily={BIZLINK_FONTS.medium} color="#B4740A" flex={1} lineHeight={16}>
            Choose at least one agenda topic before the "Finish" button becomes active.
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
      {!saving ? <BizButton label="Cancel meeting" variant="white" onPress={onCancel} /> : null}
    </YStack>
  );
}
