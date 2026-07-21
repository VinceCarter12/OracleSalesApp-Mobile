import { XStack } from 'tamagui';
import { BizChip } from '../bizlink/BizChip';
import { MEETING_AGENDAS } from '../../types';

interface AgendaChecklistProps {
  selected: string[];
  onToggle: (agenda: string) => void;
}

/**
 * Shared agenda checklist — used by both the full Record Meeting form and the
 * existing-client fast path. "Product Presentation" ticks here are what drive
 * the presentation progress-% (B-001), so the fast path must include this too.
 *
 * Rewritten 2026-07-21 (was plain Tamagui `Checkbox`/`Label`, the last
 * pre-BizLink holdout in the Record Meeting flows — Vince flagged the fast
 * path's "Meeting in progress" screen as visually inconsistent with the rest
 * of the app) to use `BizChip` pills, matching record.tsx's own inline
 * agenda rendering (`MeetingWrapUpSection.tsx`) exactly.
 */
export function AgendaChecklist({ selected, onToggle }: AgendaChecklistProps) {
  return (
    <XStack gap="$2" flexWrap="wrap">
      {MEETING_AGENDAS.map((agenda) => (
        <BizChip
          key={agenda}
          label={agenda}
          selected={selected.includes(agenda)}
          onPress={() => onToggle(agenda)}
        />
      ))}
    </XStack>
  );
}
