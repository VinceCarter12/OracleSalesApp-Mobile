import { Spinner, Text, XStack } from 'tamagui';
import { useBizlinkColors, BIZLINK_FONTS } from '../../lib/theme';
import { BizCard } from '../bizlink/BizCard';

export type AgendaStage = 'prospect' | 'in_progress';

// Wireframe-Sales-BizLink.html:1733-1735 (`aRenderRecordStage()`) — quoted
// verbatim, not paraphrased, per the wireframe-fidelity rule.
export function agendaStageCopy(stage: AgendaStage): { title: string; note: string } {
  if (stage === 'in_progress') {
    return {
      title: 'In Progress agenda',
      note: 'Complete the topics not covered in Prospect. Successful + Close deal + approved PO + cleared tag-along gate moves this client to New.',
    };
  }
  return {
    title: 'Prospect agenda',
    note: 'Valid end photo + Successful + at least one selected agenda moves Prospect to In Progress. A selected tag-along must be cleared first.',
  };
}

interface AgendaStageNoteCardProps {
  stage: AgendaStage;
  loading: boolean;
  error: boolean;
}

/**
 * record.tsx's Agenda-section stage title + acceptance-copy card
 * (Wireframe-Sales-BizLink.html `#a-recordStageTitle`/`#a-recordStageNote`,
 * lines 700-703) — extracted so record.tsx (already near the 300-line file
 * cap) stays under it. `loading`/`error` reflect
 * `lib/meeting-agenda-stage-source.ts`'s async agenda-list resolution.
 */
export function AgendaStageNoteCard({ stage, loading, error }: AgendaStageNoteCardProps) {
  const BIZLINK_COLORS = useBizlinkColors();
  const copy = agendaStageCopy(stage);
  return (
    <BizCard flat borderRadius={20} padding={14} marginBottom="$2.5">
      <Text fontFamily={BIZLINK_FONTS.semibold} fontSize={13} color={BIZLINK_COLORS.ink}>
        {copy.title}
      </Text>
      <Text fontSize={11.5} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.ink} marginTop="$1" lineHeight={16}>
        {copy.note}
      </Text>
      {loading ? (
        <XStack alignItems="center" gap="$1.5" marginTop="$2">
          <Spinner size="small" color={BIZLINK_COLORS.brand} />
          <Text fontSize={11} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted}>Loading agenda options…</Text>
        </XStack>
      ) : null}
      {error ? (
        <Text fontSize={11} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.red} marginTop="$2">
          Hindi na-load ang agenda list. I-check ang connection at subukang muli.
        </Text>
      ) : null}
    </BizCard>
  );
}
