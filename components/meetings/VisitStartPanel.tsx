import { MapPin } from 'lucide-react-native';
import { Text, XStack, YStack } from 'tamagui';
import { BIZLINK_COLORS, BIZLINK_FONTS, BIZLINK_ON_INK } from '../../lib/theme';
import { BizSectionHeader } from '../bizlink/BizSectionHeader';
import { BizButton } from '../bizlink/BizButton';
import { CompanionPicker } from './CompanionPicker';
import { MeetingModeToggle } from './MeetingModeToggle';
import type { MeetingMode, TeamRosterEntry } from '../../types';

interface VisitStartPanelProps {
  roster: TeamRosterEntry[];
  selectedCompanions: TeamRosterEntry[];
  onToggleCompanion: (entry: TeamRosterEntry) => void;
  mode: MeetingMode;
  onModeChange: (mode: MeetingMode) => void;
  starting: boolean;
  onStart: () => void;
}

/**
 * record-visit.tsx's pre-Start section (companion picker + meeting mode +
 * Start button), extracted so that already-near-the-cap screen stays under
 * the 300-line file limit.
 */
export function VisitStartPanel({
  roster,
  selectedCompanions,
  onToggleCompanion,
  mode,
  onModeChange,
  starting,
  onStart,
}: VisitStartPanelProps) {
  return (
    <YStack marginTop="$4" gap="$4">
      <CompanionPicker roster={roster} selected={selectedCompanions} onToggle={onToggleCompanion} />
      <MeetingModeToggle mode={mode} onChange={onModeChange} />

      <BizSectionHeader title="Start meeting" />
      <YStack backgroundColor={BIZLINK_COLORS.ink} borderRadius={24} padding={16}>
        <XStack alignItems="center" gap="$3">
          <YStack width={44} height={44} borderRadius={14} backgroundColor={BIZLINK_ON_INK.circleFill} alignItems="center" justifyContent="center">
            <MapPin size={18} color={BIZLINK_COLORS.card} strokeWidth={1.75} />
          </YStack>
          <YStack flex={1}>
            <Text fontSize={12.5} fontFamily={BIZLINK_FONTS.semibold} color={BIZLINK_COLORS.card}>GPS lang — walang photo</Text>
            <Text fontSize={11} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_ON_INK.textMuted}>
              GPS + timestamp ang naka-bind dito; magsisimula ang running timer
            </Text>
          </YStack>
        </XStack>
      </YStack>

      <BizButton label={starting ? 'Capturing GPS…' : 'Start'} onPress={onStart} disabled={starting} />
      <Text fontSize={12} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted} textAlign="center">
        Binds GPS + timestamp to the start of the meeting — no photo needed here anymore.
      </Text>
    </YStack>
  );
}
