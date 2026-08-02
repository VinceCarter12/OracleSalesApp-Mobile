import { MapPin } from 'lucide-react-native';
import { Text, XStack, YStack } from 'tamagui';
import { useBizlinkColors, BIZLINK_FONTS } from '../../lib/theme';
import type { OfficePinClient } from '../../lib/use-office-pins';
import { BizCard } from './BizCard';
import { StatusBadge } from '../ui/StatusBadge';

interface BizOfficePinRowProps {
  pin: OfficePinClient;
  onPress: () => void;
}

/**
 * Batch 8 (2026-08-02) — Sales Maps list row (`app/(tabs)/more/maps.tsx`).
 * Wireframe-Sales-BizLink.html's `aRenderOfficeMaps()` renders pins as
 * clickable markers on a decorative map surface (~line 1377); this list-row
 * form carries the same data (name, verified/unverified) as a tappable
 * `BizCard`, matching this codebase's existing list+detail pattern
 * (BizApprovalRow) rather than pulling in a real map library — no map
 * API key/library has been approved (see office-location.tsx's header
 * comment on the still-unscoped drag-to-adjust work).
 */
export function BizOfficePinRow({ pin, onPress }: BizOfficePinRowProps) {
  const BIZLINK_COLORS = useBizlinkColors();
  return (
    <BizCard onPress={onPress} pressStyle={{ opacity: 0.85 }} marginBottom={10} gap="$1.5">
      <XStack alignItems="center" gap="$2.5">
        <YStack
          width={36}
          height={36}
          borderRadius={18}
          backgroundColor={pin.verified ? BIZLINK_COLORS.tintA : BIZLINK_COLORS.amberSoft}
          alignItems="center"
          justifyContent="center"
        >
          <MapPin size={16} color={pin.verified ? BIZLINK_COLORS.brand : BIZLINK_COLORS.orange} strokeWidth={1.75} />
        </YStack>
        <Text flex={1} fontFamily={BIZLINK_FONTS.semibold} fontSize={14} color={BIZLINK_COLORS.text}>
          {pin.companyName}
        </Text>
        {pin.verified ? (
          <StatusBadge label="Verified" background={BIZLINK_COLORS.tintA} color={BIZLINK_COLORS.brand} />
        ) : (
          <StatusBadge label="Unverified" background={BIZLINK_COLORS.amberSoft} color={BIZLINK_COLORS.orange} />
        )}
      </XStack>
      <Text fontSize={11.5} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted}>
        {pin.officeLat.toFixed(4)}, {pin.officeLng.toFixed(4)}
      </Text>
    </BizCard>
  );
}
