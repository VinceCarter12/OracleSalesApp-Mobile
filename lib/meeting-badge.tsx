import { COLORS, OUTCOME_BADGE_STYLES } from './theme';
import { StatusBadge } from '../components/ui/StatusBadge';
import { MANAGER_OUTCOME_LABELS, type TeamMeeting } from '../types';

/**
 * Mirrors meetingBadge() in Wireframe.html — ADR-015 fast-path meetings have
 * no outcome, so they show "Photo visit" instead of falling through to a dash.
 */
export function meetingBadge(meeting: TeamMeeting): React.ReactElement {
  if (meeting.fastPath || !meeting.outcome) {
    return <StatusBadge label="Photo visit" background={COLORS.greenTint} color={COLORS.ledgeGreen} />;
  }
  const label = MANAGER_OUTCOME_LABELS[meeting.outcome];
  const style = OUTCOME_BADGE_STYLES[label];
  return <StatusBadge label={label} background={style.background} color={style.color} />;
}
