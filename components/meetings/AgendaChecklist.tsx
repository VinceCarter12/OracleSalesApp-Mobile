import { Checkbox, Label, Text, XStack, YStack } from 'tamagui';
import { MEETING_AGENDAS } from '../../types';

interface AgendaChecklistProps {
  selected: string[];
  onToggle: (agenda: string) => void;
}

/**
 * Shared agenda checklist — used by both the full Record Meeting form and the
 * existing-client fast path. "Product Presentation" ticks here are what drive
 * the presentation progress-% (B-001), so the fast path must include this too.
 */
export function AgendaChecklist({ selected, onToggle }: AgendaChecklistProps) {
  return (
    <YStack gap="$2">
      <Label>Agenda (select all that apply)</Label>
      {MEETING_AGENDAS.map((agenda) => (
        <XStack key={agenda} gap="$3" alignItems="center">
          <Checkbox
            id={agenda}
            size="$4"
            checked={selected.includes(agenda)}
            onCheckedChange={() => onToggle(agenda)}
          >
            <Checkbox.Indicator>
              <Text>✓</Text>
            </Checkbox.Indicator>
          </Checkbox>
          <Label htmlFor={agenda}>{agenda}</Label>
        </XStack>
      ))}
    </YStack>
  );
}
