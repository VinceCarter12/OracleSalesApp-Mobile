import { Switch } from 'react-native';
import { Globe } from 'lucide-react-native';
import { Text, XStack, YStack } from 'tamagui';
import { useBizlinkColors, BIZLINK_FONTS } from '../../lib/theme';

interface OrgWideProspectFilterRowProps {
  enabled: boolean;
  onChange: (value: boolean) => void;
}

/**
 * Filter-sheet row for the org-wide prospect pin layer (2026-08-16, Vince
 * direction) — shared by all three Maps screens' `BizFilterSheet`. Same
 * row shape as `components/security/LockToggleRow.tsx` (icon + label/sublabel
 * + `Switch`), the closest existing on/off toggle pattern in this codebase,
 * reused rather than inventing a new toggle control.
 */
export function OrgWideProspectFilterRow({ enabled, onChange }: OrgWideProspectFilterRowProps) {
  const BIZLINK_COLORS = useBizlinkColors();
  return (
    <XStack alignItems="center" gap="$2.5" paddingVertical={12} minHeight={44}>
      <Globe size={16} color={BIZLINK_COLORS.text} strokeWidth={1.75} />
      <YStack flex={1}>
        <Text fontSize={13.5} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.text}>
          Org-wide prospects
        </Text>
        <Text fontSize={11} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted}>
          Show prospect pins from every team, not just yours
        </Text>
      </YStack>
      <Switch value={enabled} onValueChange={onChange} trackColor={{ true: BIZLINK_COLORS.brand, false: BIZLINK_COLORS.line }} />
    </XStack>
  );
}
