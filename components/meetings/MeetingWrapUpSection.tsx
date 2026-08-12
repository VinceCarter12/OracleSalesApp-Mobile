import { TextInput } from 'react-native';
import { Text, XStack } from 'tamagui';
import { useBizlinkColors, BIZLINK_FONTS } from '../../lib/theme';
import { REMARKS_MAX_LENGTH } from '../../lib/field-validation';
import { BizSectionHeader } from '../bizlink/BizSectionHeader';
import { BizChip } from '../bizlink/BizChip';
import { type MeetingOutcome } from '../../types';

interface MeetingWrapUpSectionProps {
  /** Meeting-Flow Wireframe Parity Audit 2026-08-03 item 5: caller-resolved, stage-aware agenda tile labels (lib/meeting-agenda-stage-source.ts) — this component no longer hardcodes the full MEETING_AGENDAS list. */
  agendaOptions: string[];
  selectedAgendas: string[];
  onToggleAgenda: (agenda: string) => void;
  /** Stage title + acceptance-copy card (Wireframe-Sales-BizLink.html `#a-recordStageTitle`/`#a-recordStageNote`, lines 700-703), rendered between the helper caption and the tiles. */
  agendaNote?: React.ReactNode;
  remarks: string;
  onRemarksChange: (value: string) => void;
  outcome: MeetingOutcome | null;
  onSelectOutcome: (outcome: MeetingOutcome) => void;
  /** ADR-044/046 point 7: the PoEvidenceCard slots in right after the agenda tiles, before the capture section — matching Wireframe-Sales-BizLink.html's `#a-poEvidence` placement exactly. */
  afterAgenda?: React.ReactNode;
  /**
   * Layout change (2026-08-09, Vince direct instruction): the Auto-captured
   * GPS/date-time/selfie block now renders ABOVE Meeting outcome instead of
   * at the very end of the flow — caller (record.tsx) passes its
   * `AutoCapturedPanel` here. Remarks moved to sit directly above the Save
   * button, below Meeting outcome (see render order below).
   */
  captureSection?: React.ReactNode;
}

/**
 * Record Meeting's Agenda + Remarks + Outcome sections, extracted so
 * record.tsx (already near the 300-line file cap) stays under it.
 */
export function MeetingWrapUpSection({
  agendaOptions,
  selectedAgendas,
  onToggleAgenda,
  agendaNote,
  remarks,
  onRemarksChange,
  outcome,
  onSelectOutcome,
  afterAgenda,
  captureSection,
}: MeetingWrapUpSectionProps) {
  const BIZLINK_COLORS = useBizlinkColors();
  return (
    <>
      {/* Wireframe-Sales-BizLink.html:699 — "Agenda · stage-aware", not the
          generic "piliin lahat" caption this used to carry. */}
      <BizSectionHeader title="Agenda" />
      <Text fontSize={12} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted} marginTop={-6} marginBottom="$2" lineHeight={17}>
        Your client's progress percentage is based on whether you tick "Product / company presentation" in
        this meeting's agenda. Completing the client's other information does not raise the percentage anymore.
      </Text>
      {agendaNote}
      <XStack gap="$2" flexWrap="wrap">
        {agendaOptions.map((agenda) => (
          <BizChip
            key={agenda}
            label={agenda}
            selected={selectedAgendas.includes(agenda)}
            onPress={() => onToggleAgenda(agenda)}
          />
        ))}
      </XStack>
      {afterAgenda}

      {captureSection}

      <BizSectionHeader title="Meeting outcome *" />
      <XStack gap="$2" flexWrap="wrap">
        <BizChip label="✓ Successful" tone="ok" selected={outcome === 'Successful'} onPress={() => onSelectOutcome('Successful')} />
        <BizChip label="Follow-up required" selected={outcome === 'Follow-up Required'} onPress={() => onSelectOutcome('Follow-up Required')} />
        <BizChip label="No decision" selected={outcome === 'No Decision'} onPress={() => onSelectOutcome('No Decision')} />
        <BizChip label="Lost opportunity" tone="lost" selected={outcome === 'Lost Opportunity'} onPress={() => onSelectOutcome('Lost Opportunity')} />
      </XStack>

      <BizSectionHeader title="Remarks" />
      <TextInput
        value={remarks}
        onChangeText={onRemarksChange}
        placeholder="Notes / comments…"
        placeholderTextColor={BIZLINK_COLORS.muted}
        multiline
        maxLength={REMARKS_MAX_LENGTH}
        style={{
          height: 74,
          borderRadius: 16,
          paddingHorizontal: 16,
          paddingVertical: 14,
          fontFamily: BIZLINK_FONTS.medium,
          fontSize: 14.5,
          color: BIZLINK_COLORS.text,
          backgroundColor: BIZLINK_COLORS.card,
          borderWidth: 1,
          borderColor: BIZLINK_COLORS.line,
          textAlignVertical: 'top',
        }}
      />
    </>
  );
}
