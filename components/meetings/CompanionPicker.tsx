import { Text, XStack } from 'tamagui';
import { BIZLINK_COLORS, BIZLINK_FONTS } from '../../lib/theme';
import { inviteeKindForRole } from '../../lib/team-roster';
import { BizChip } from '../bizlink/BizChip';
import { BizSectionHeader } from '../bizlink/BizSectionHeader';
import type { TeamRosterEntry } from '../../types';

const ROSTER_KIND_LABEL: Record<'manager' | 'teammate', string> = { manager: 'Manager', teammate: 'Teammate' };

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
  return (
    <>
      <BizSectionHeader title="Kasama sa visit" helper="optional · max 2" />
      <Text fontSize={12.5} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted} marginTop={-6} marginBottom="$2.5" lineHeight={17}>
        Pumili ng manager o ka-team na kasama mo sa visit na ito — maabisuhan sila at kailangan nilang i-accept. Tuloy ka pa
        rin agad sa pag-record habang pending ang sagot nila.
      </Text>
      {roster.length === 0 ? (
        <Text fontSize={11.5} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted} marginBottom="$3">
          Team list hindi pa na-sync — kumonekta para makapili ng kasama.
        </Text>
      ) : (
        <XStack gap="$2" flexWrap="wrap" marginBottom="$3">
          {roster.map((entry) => (
            <BizChip
              key={entry.profileId}
              label={`${entry.fullName} · ${ROSTER_KIND_LABEL[inviteeKindForRole(entry.role)]}`}
              selected={selected.some((p) => p.profileId === entry.profileId)}
              onPress={() => onToggle(entry)}
            />
          ))}
        </XStack>
      )}
    </>
  );
}
