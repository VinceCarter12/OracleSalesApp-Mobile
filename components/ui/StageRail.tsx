import { Text, View, XStack } from 'tamagui';
import { useBizlinkColors, BIZLINK_FONTS } from '../../lib/theme';
import type { ClientStatus } from '../../types';

/**
 * Wireframe-Sales-BizLink.html `.stage-rail`/`.stage-labels` (CSS lines
 * 377-380) — 4-segment lifecycle progress rail. Shared by client detail
 * (`#a-detailStageRail`/`.stage-labels`, lines 604-605) and Record Meeting's
 * selected-company header card (`aSelectedCompanyProgressCard()`, lines
 * 1665-1677) — both wireframe call sites render the identical rail, so this
 * is the one shared implementation (was duplicated inline in
 * `app/(tabs)/clients/[id].tsx` before this extraction).
 *
 * 'inactive' is a terminal status outside this progression — STAGE_ORDER's
 * indexOf returns -1 for it (and for a null/loading status), which correctly
 * renders every segment as not-yet-reached rather than guessing a position.
 */
export const STAGE_ORDER: ClientStatus[] = ['prospect', 'in_progress', 'new', 'existing'];
export const STAGE_LABELS = ['Prospect', 'In Progress', 'New', 'Existing'];

interface StageRailProps {
  status: ClientStatus | null;
}

export function StageRail({ status }: StageRailProps) {
  const BIZLINK_COLORS = useBizlinkColors();
  const stageIndex = status ? STAGE_ORDER.indexOf(status) : -1;
  return (
    <>
      <XStack gap="$1.5" marginTop="$3" marginBottom="$1">
        {STAGE_ORDER.map((stage, index) => (
          <View
            key={stage}
            flex={1}
            height={6}
            borderRadius={99}
            backgroundColor={stageIndex >= 0 && index <= stageIndex ? BIZLINK_COLORS.brand : BIZLINK_COLORS.line}
          />
        ))}
      </XStack>
      <XStack marginBottom="$1">
        {STAGE_LABELS.map((label) => (
          <Text
            key={label}
            flex={1}
            textAlign="center"
            fontSize={8.5}
            fontFamily={BIZLINK_FONTS.semibold}
            color={BIZLINK_COLORS.muted}
          >
            {label}
          </Text>
        ))}
      </XStack>
    </>
  );
}
