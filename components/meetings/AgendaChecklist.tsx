import { XStack } from 'tamagui';
import { BizChip } from '../bizlink/BizChip';
import { CLOSE_DEAL_AGENDA, MEETING_AGENDAS } from '../../types';

interface AgendaChecklistProps {
  selected: string[];
  onToggle: (agenda: string) => void;
}

/**
 * Shared agenda checklist — used by the existing-client fast path only now
 * (the full Record Meeting form resolved its own stage-aware tiles via
 * lib/meeting-agenda-stage-source.ts). "Product Presentation" ticks here are
 * what drive the presentation progress-% (B-001), so the fast path must
 * include this too.
 *
 * 'Close deal' is deliberately excluded: this screen only sees new/existing
 * clients, and close-deal/PO evidence is structurally only for In Progress
 * via the full form (matches the Sales wireframe's own `#a-visitAgendaTiles`
 * — six ordinary agendas, no Close deal).
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
      {MEETING_AGENDAS.filter((agenda) => agenda !== CLOSE_DEAL_AGENDA).map((agenda) => (
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
