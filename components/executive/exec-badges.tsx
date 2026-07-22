import { COLORS, OUTCOME_BADGE_STYLES } from '../../lib/theme';
import { StatusBadge } from '../ui/StatusBadge';
import { MANAGER_OUTCOME_LABELS, type ManagerOutcome } from '../../types';

/**
 * Mirrors outcomeBadge() in Wireframe-Agent-Executive.html for the Executive
 * views. B-054 Phase 2: real ADR-015 fast-path meetings have no outcome —
 * nullable now, same "Photo visit" fallback as lib/meeting-badge.tsx's
 * meetingBadge() (Manager's equivalent) uses for the same case.
 */
export function execOutcomeBadge(outcome: ManagerOutcome | null): React.ReactElement {
  if (!outcome) {
    return <StatusBadge label="Photo visit" background={COLORS.greenTint} color={COLORS.ledgeGreen} />;
  }
  const label = MANAGER_OUTCOME_LABELS[outcome];
  const style = OUTCOME_BADGE_STYLES[label];
  return <StatusBadge label={label} background={style.background} color={style.color} />;
}
