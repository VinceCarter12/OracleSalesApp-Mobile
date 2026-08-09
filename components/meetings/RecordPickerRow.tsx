import { Animated, Pressable } from 'react-native';
import { router } from 'expo-router';
import { Text, XStack, YStack } from 'tamagui';
import { useBizlinkColors, BIZLINK_FONTS } from '../../lib/theme';
import { SALES_CLIENT_STATUS_BADGES, getClientStatus, isFastPathEligible } from '../../lib/client-status';
import { useClientFlowRoutes, type ClientFlowRoutes } from '../../lib/use-role-routes';
import { usePulseGlow } from '../../lib/use-pulse-glow';
import { StatusBadge } from '../ui/StatusBadge';
import type { Client, ClientStatus } from '../../types';

// Record-picker status filter (Wireframe-Sales-BizLink.html #a-record,
// aRecordPickerFilter/aRenderRecordPicker). Pure UI filter/hint over the
// already-loaded client list.
//
// ADR-042 follow-up (2026-07-28, verified against the wireframe directly):
// `openRecordFlow`/`RecordPickerRow`'s hint below route via
// `isFastPathEligible` (new/existing whitelist), matching
// `Wireframe-Sales-BizLink.html:1590` exactly — an in_progress client
// reached via the 'all' filter now correctly gets the full form instead of
// being misrouted to the fast path. The filter chip list and default now
// also match the wireframe's own `aRecordPickerFilter` initial value
// (`var aRecordPickerFilter='all'`, line 1549) and its `statuses` array
// (line 1574: `[['all','All'],['prospect','Prospect'],
// ['in_progress','In Progress'],['new','New'],['existing','Existing']]`) —
// 'existing' was both the wrong default and missing the 'in_progress' chip
// before this fix.
export type RecordPickerFilter = ClientStatus | 'all';
export const RECORD_PICKER_FILTERS: Array<{ value: RecordPickerFilter; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'prospect', label: 'Prospect' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'new', label: 'New' },
  { value: 'existing', label: 'Existing' },
];

// Wireframe-Sales-BizLink.html:1581 —
// `var hint = c.status==='prospect' ? 'Qualify Opportunity' :
// (c.status==='in_progress' ? 'Advance Deal' : (c.status==='new' ?
// 'New Customer Visit' : 'Existing Customer Visit'));` — four distinct
// per-status strings, not a binary fast-path/full-form label.
function recordPickerHint(status: ClientStatus): string {
  switch (status) {
    case 'prospect':
      return 'Qualify Opportunity';
    case 'in_progress':
      return 'Advance Deal';
    case 'new':
      return 'New Customer Visit';
    case 'existing':
    default:
      return 'Existing Customer Visit';
  }
}

/**
 * Record Meeting entry point (ADR-015, revised 2026-07-21; ADR-042 fix
 * 2026-07-28). The branch happens HERE, at client selection — customer type
 * is derived from the record, never asked:
 *   new / existing         → photo-only fast path (record-visit)
 *   prospect / in_progress → full form (record)
 * A 'new' client already has its info completed (ADR-027's auto-promotion
 * requires it) — there's nothing left to re-ask, so it gets the same fast
 * path as 'existing'. Meeting-first (quick-create inline on the record form)
 * was removed 2026-07-15 — a brand-new company is created via Create Client
 * first, then shows up here under Prospect.
 *
 * Matches `Wireframe-Sales-BizLink.html:1592`'s
 * `if(c.status!=='prospect' && c.status!=='in_progress'){ aOpenRecordVisit(id);
 * return; }` — the wireframe whitelists fast-path eligibility to
 * new/existing rather than blacklisting just 'prospect', so a future fifth
 * stage doesn't silently fall into the fast path. `isFastPathEligible`
 * (lib/client-status.ts) already encodes that same new/existing whitelist —
 * reused here instead of re-deriving the condition.
 */
export function openRecordFlow(client: Client, routes: ClientFlowRoutes): void {
  if (isFastPathEligible(client)) {
    router.push(routes.recordVisit(client.id));
  } else {
    router.push(routes.recordMeeting(client.id));
  }
}

interface RecordPickerRowProps {
  client: Client;
  rowNumber: number;
  /**
   * 2026-08-09 (Vince direct instruction): distinct from the `status`
   * lifecycle badge ("In Progress" can apply to many rows) — this is
   * specifically "this client has a meeting_draft actively running right
   * now" (lib/use-active-meeting-drafts.ts), so the row number badge glows
   * green, matching the Home "I-record ang meeting" tile's pulse, letting
   * the agent immediately spot which exact meeting is the live one.
   */
  isMeetingActive?: boolean;
}

export function RecordPickerRow({ client, rowNumber, isMeetingActive = false }: RecordPickerRowProps) {
  const BIZLINK_COLORS = useBizlinkColors();
  const routes = useClientFlowRoutes();
  const status = getClientStatus(client);
  const badge = SALES_CLIENT_STATUS_BADGES[status];
  const hint = recordPickerHint(status);
  const pulse = usePulseGlow(isMeetingActive);
  const badgeBg = pulse.interpolate({ inputRange: [0, 1], outputRange: [BIZLINK_COLORS.brand, '#3FA96C'] });
  const badgeShadowOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.25, 0.6] });

  return (
    <Pressable onPress={() => openRecordFlow(client, routes)}>
      <XStack
        alignItems="center"
        justifyContent="space-between"
        backgroundColor={BIZLINK_COLORS.card}
        borderRadius={20}
        padding={16}
        marginBottom={10}
        gap="$2.5"
      >
        {isMeetingActive ? (
          <Animated.View
            style={{
              width: 26,
              height: 26,
              borderRadius: 13,
              backgroundColor: badgeBg,
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              shadowColor: BIZLINK_COLORS.brand,
              shadowOpacity: badgeShadowOpacity,
              shadowRadius: 6,
              shadowOffset: { width: 0, height: 0 },
              elevation: 3,
            }}
          >
            <Text fontSize={11} fontFamily={BIZLINK_FONTS.semibold} color="#FFFFFF">
              {rowNumber}
            </Text>
          </Animated.View>
        ) : (
          <YStack
            width={26}
            height={26}
            borderRadius={13}
            backgroundColor={BIZLINK_COLORS.soft}
            alignItems="center"
            justifyContent="center"
            flexShrink={0}
          >
            <Text fontSize={11} fontFamily={BIZLINK_FONTS.semibold} color={BIZLINK_COLORS.muted}>
              {rowNumber}
            </Text>
          </YStack>
        )}
        <YStack gap="$0.5" flex={1}>
          <Text fontFamily={BIZLINK_FONTS.semibold} fontSize={14} color={BIZLINK_COLORS.text}>{client.company_name}</Text>
          <Text fontSize={11.5} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted}>{hint}</Text>
        </YStack>
        <StatusBadge {...badge} />
      </XStack>
    </Pressable>
  );
}
