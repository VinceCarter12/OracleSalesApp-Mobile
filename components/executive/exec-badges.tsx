import { OUTCOME_BADGE_STYLES } from '../../lib/theme';
import { StatusBadge } from '../ui/StatusBadge';
import { MANAGER_OUTCOME_LABELS, type ManagerOutcome } from '../../types';

/** Mirrors outcomeBadge() in Wireframe-Agent-Executive.html for the Executive views. */
export function execOutcomeBadge(outcome: ManagerOutcome): React.ReactElement {
  const label = MANAGER_OUTCOME_LABELS[outcome];
  const style = OUTCOME_BADGE_STYLES[label];
  return <StatusBadge label={label} background={style.background} color={style.color} />;
}
