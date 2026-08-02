import { Text, YStack } from 'tamagui';
import { BIZLINK_COLORS, BIZLINK_FONTS } from '../../lib/theme';
import { BizFilterScroll, type BizFilterOption } from './BizFilterScroll';
import { useManagerScope } from '../../lib/manager-scope-store';
import type { ManagerScope } from '../../lib/manager-scope';

const SCOPE_OPTIONS: BizFilterOption<ManagerScope>[] = [
  { value: 'mine', label: 'My Records' },
  { value: 'team', label: 'My Team' },
  { value: 'combined', label: 'Combined' },
];

/**
 * Design-System-Catalog "BizScopeFilter" — label + `BizFilterScroll` chip
 * row for the manager record scope. Labels/order/values match
 * Wireframe-Manager-BizLink.html's `renderManagerScope()` exactly (line
 * ~1121: `[['mine','My Records'],['team','My Team'],['combined','Combined']]`).
 *
 * Reads/writes `useManagerScope()` itself — no scope prop needed from
 * callers, so Manager Home and Manager Meetings (PR C's only two consumers,
 * ADR-052 §G) both just drop this in.
 */
export function BizScopeFilter() {
  const { scope, setScope } = useManagerScope();
  return (
    <YStack gap="$1.5">
      <Text fontSize={11} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted} letterSpacing={0.4}>
        Record scope
      </Text>
      <BizFilterScroll options={SCOPE_OPTIONS} value={scope} onChange={setScope} />
    </YStack>
  );
}
