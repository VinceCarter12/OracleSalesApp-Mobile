import { Text, XStack, YStack } from 'tamagui';
import { BizChip } from '../bizlink/BizChip';
import { BizFilterSheetRow } from '../bizlink/BizFilterSheetRow';
import type { BizFilterOption } from '../bizlink/BizFilterScroll';
import { useBizlinkColors, BIZLINK_FONTS } from '../../lib/theme';
import type { ManagerScope } from '../../lib/manager-scope';
import type { TeamMember } from '../../lib/manager-team-map-service';

// Duplicated from BizScopeFilter's own SCOPE_OPTIONS (this row lives inside
// Maps' Filters sheet, not the always-visible chip row BizScopeFilter
// renders elsewhere — see that file's doc comment for why Maps has its own
// copy). Kept in sync by hand; if a 5th scope value is ever added, update
// both.
const SCOPE_OPTIONS: BizFilterOption<ManagerScope>[] = [
  { value: 'mine', label: 'My Records' },
  { value: 'team', label: 'My Team' },
  { value: 'combined', label: 'Combined' },
  { value: 'guest', label: 'Guest Records' },
];

/**
 * Manager Maps' "Record scope" row inside the Filters sheet (Vince,
 * 2026-08-10 — moved out of the always-visible header on request). Same
 * `ManagerScope` values/labels as `BizScopeFilter` (Manager Home/Meetings),
 * rendered as a `BizFilterSheetRow` to match the rest of this sheet. Maps-only
 * addition: once "My Team" is selected, a teammate picker appears so the
 * manager can narrow the map to one agent instead of the whole team.
 */
export function ManagerMapScopeFilterRow({
  scope,
  onScopeChange,
  teamAgents,
  teamAgentFilter,
  onTeamAgentFilterChange,
}: {
  scope: ManagerScope;
  onScopeChange: (value: ManagerScope) => void;
  teamAgents: TeamMember[];
  teamAgentFilter: string | null;
  onTeamAgentFilterChange: (agentId: string | null) => void;
}) {
  const BIZLINK_COLORS = useBizlinkColors();
  const scopeLabel = SCOPE_OPTIONS.find((option) => option.value === scope)?.label ?? scope;
  const teammateLabel = teamAgentFilter
    ? teamAgents.find((agent) => agent.id === teamAgentFilter)?.fullName ?? 'All'
    : 'All';

  return (
    <BizFilterSheetRow label="Record scope" value={scope === 'team' ? `${scopeLabel} · ${teammateLabel}` : scopeLabel}>
      <YStack gap="$2">
        <XStack gap="$2" flexWrap="wrap">
          {SCOPE_OPTIONS.map((option) => (
            <BizChip
              key={option.value}
              label={option.label}
              selected={scope === option.value}
              onPress={() => onScopeChange(option.value)}
            />
          ))}
        </XStack>
        {scope === 'team' && teamAgents.length > 0 ? (
          <YStack gap="$1.5" marginTop="$1">
            <Text fontSize={11} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted} letterSpacing={0.4}>
              Teammate
            </Text>
            <XStack gap="$2" flexWrap="wrap">
              <BizChip label="All" selected={teamAgentFilter === null} onPress={() => onTeamAgentFilterChange(null)} />
              {teamAgents.map((agent) => (
                <BizChip
                  key={agent.id}
                  label={agent.fullName}
                  selected={teamAgentFilter === agent.id}
                  onPress={() => onTeamAgentFilterChange(agent.id)}
                />
              ))}
            </XStack>
          </YStack>
        ) : null}
      </YStack>
    </BizFilterSheetRow>
  );
}
