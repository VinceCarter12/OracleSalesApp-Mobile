import { Text, XStack } from 'tamagui';
import { AlertTriangle } from 'lucide-react-native';
import { BIZLINK_COLORS, BIZLINK_FONTS } from '../../lib/theme';
import { BizSectionHeader } from '../bizlink/BizSectionHeader';
import { BizChip } from '../bizlink/BizChip';
import type { MeetingMode } from '../../types';

interface MeetingModeToggleProps {
  mode: MeetingMode;
  onChange: (mode: MeetingMode) => void;
}

/**
 * In-person / online meeting selector (ADR-012). For online meetings the GPS
 * captured with the photo is the agent's own location, and the record carries
 * this flag so maps/reports never plot it as a client-site visit. Matches
 * Wireframe-Sales-BizLink.html's `id="a-record"` Meeting mode block (`.seg`
 * pills + `#a-modeOnlineNote` warning) — BizChip/BizSectionHeader, not plain
 * Tamagui theme components.
 */
export function MeetingModeToggle({ mode, onChange }: MeetingModeToggleProps) {
  return (
    <>
      <BizSectionHeader title="Meeting mode" helper="· ADR-012" />
      <XStack gap="$2">
        <BizChip label="In-person" selected={mode === 'in_person'} onPress={() => onChange('in_person')} />
        <BizChip label="Online" selected={mode === 'online'} onPress={() => onChange('online')} />
      </XStack>
      {mode === 'online' ? (
        <XStack gap="$1.5" alignItems="flex-start" marginTop="$1.5">
          <AlertTriangle size={13} color={BIZLINK_COLORS.orange} strokeWidth={1.75} style={{ marginTop: 2 }} />
          <Text fontSize={11.5} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted} flex={1} lineHeight={16}>
            Online meeting — ang GPS na makukuha ay sa lokasyon MO, hindi sa client. Hindi ito bibilangin bilang
            client-site visit sa maps/reports.
          </Text>
        </XStack>
      ) : null}
    </>
  );
}
