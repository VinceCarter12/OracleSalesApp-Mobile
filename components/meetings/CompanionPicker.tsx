import { Text, XStack } from 'tamagui';
import { useBizlinkColors, BIZLINK_FONTS } from '../../lib/theme';
import { useSession } from '../../lib/session-store';
import { companionRoleLabel } from '../../lib/policies/companion-label-policy';
import { BizChip } from '../bizlink/BizChip';
import { BizSectionHeader } from '../bizlink/BizSectionHeader';
import type { TeamRosterEntry } from '../../types';

interface CompanionPickerProps {
  roster: TeamRosterEntry[];
  selected: TeamRosterEntry[];
  onToggle: (entry: TeamRosterEntry) => void;
}

/**
 * ADR-030 Pass 2.5: "Kasama sa visit" companion picker, lifted out of
 * Complete Info (its original Pass 2 home) into a shared component so
 * Record Meeting — the corrected placement, since "kasama sa visit" is
 * inherently about who attends the meeting — can use it without pushing
 * that already-near-the-limit screen over the 300-line file cap.
 * `team_roster_snapshot` (via `roster`) is a read-only sync-down mirror —
 * an empty array means it hasn't synced yet (or the agent has no team), in
 * which case this shows the offline helper and stays fully skippable.
 */
export function CompanionPicker({ roster, selected, onToggle }: CompanionPickerProps) {
  const BIZLINK_COLORS = useBizlinkColors();
  const { teamId } = useSession();
  return (
    <>
      <BizSectionHeader title="Companions on this visit" helper="optional · max 2" />
      <Text fontSize={12.5} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted} marginTop={-6} marginBottom="$2.5" lineHeight={17}>
        Pick a manager or teammate to join you on this visit — they'll be notified and need to accept. You can keep
        recording right away while you wait for their answer.
      </Text>
      {roster.length === 0 ? (
        <Text fontSize={11.5} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted} marginBottom="$3">
          The team list isn't loaded yet — connect to the internet to pick your companions.
        </Text>
      ) : (
        <XStack gap="$2" flexWrap="wrap" marginBottom="$3">
          {roster.map((entry) => (
            <BizChip
              key={entry.profileId}
              label={`${entry.fullName} · ${companionRoleLabel(entry, teamId)}`}
              selected={selected.some((p) => p.profileId === entry.profileId)}
              onPress={() => onToggle(entry)}
            />
          ))}
        </XStack>
      )}
    </>
  );
}
