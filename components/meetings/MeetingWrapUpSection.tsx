import { TextInput } from 'react-native';
import { Text, XStack } from 'tamagui';
import { BIZLINK_COLORS, BIZLINK_FONTS } from '../../lib/theme';
import { BizSectionHeader } from '../bizlink/BizSectionHeader';
import { BizChip } from '../bizlink/BizChip';
import { MEETING_AGENDAS, type MeetingOutcome } from '../../types';

interface MeetingWrapUpSectionProps {
  selectedAgendas: string[];
  onToggleAgenda: (agenda: string) => void;
  remarks: string;
  onRemarksChange: (value: string) => void;
  outcome: MeetingOutcome | null;
  onSelectOutcome: (outcome: MeetingOutcome) => void;
}

/**
 * Record Meeting's Agenda + Remarks + Outcome sections, extracted so
 * record.tsx (already near the 300-line file cap) stays under it.
 */
export function MeetingWrapUpSection({
  selectedAgendas,
  onToggleAgenda,
  remarks,
  onRemarksChange,
  outcome,
  onSelectOutcome,
}: MeetingWrapUpSectionProps) {
  return (
    <>
      <BizSectionHeader title="Agenda" helper="· piliin lahat" />
      <Text fontSize={12} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted} marginTop={-6} marginBottom="$2" lineHeight={17}>
        Ang "Product / company presentation" tick dito ang buong basehan ng progress % ng client — hindi na Complete Info (B-001).
      </Text>
      <XStack gap="$2" flexWrap="wrap">
        {MEETING_AGENDAS.map((agenda) => (
          <BizChip
            key={agenda}
            label={agenda}
            selected={selectedAgendas.includes(agenda)}
            onPress={() => onToggleAgenda(agenda)}
          />
        ))}
      </XStack>

      <BizSectionHeader title="Remarks" />
      <TextInput
        value={remarks}
        onChangeText={onRemarksChange}
        placeholder="Notes / comments…"
        placeholderTextColor={BIZLINK_COLORS.muted}
        multiline
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

      <BizSectionHeader title="Meeting outcome *" />
      <XStack gap="$2" flexWrap="wrap">
        <BizChip label="✓ Successful" tone="ok" selected={outcome === 'Successful'} onPress={() => onSelectOutcome('Successful')} />
        <BizChip label="Follow-up required" selected={outcome === 'Follow-up Required'} onPress={() => onSelectOutcome('Follow-up Required')} />
        <BizChip label="No decision" selected={outcome === 'No Decision'} onPress={() => onSelectOutcome('No Decision')} />
        <BizChip label="Lost opportunity" tone="lost" selected={outcome === 'Lost Opportunity'} onPress={() => onSelectOutcome('Lost Opportunity')} />
      </XStack>
    </>
  );
}
