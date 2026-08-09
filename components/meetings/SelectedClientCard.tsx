import { Pressable } from 'react-native';
import { router } from 'expo-router';
import type { Href } from 'expo-router';
import { ChartNoAxesCombined } from 'lucide-react-native';
import { Text, XStack, YStack } from 'tamagui';
import { useBizlinkColors, BIZLINK_FONTS } from '../../lib/theme';
import { SALES_CLIENT_STATUS_BADGES } from '../../lib/client-status';
import { Avatar } from '../ui/Avatar';
import { StatusBadge } from '../ui/StatusBadge';
import { StageRail } from '../ui/StageRail';
import type { ClientStatus } from '../../types';
import type { ClientJourneyProgress } from '../../lib/client-progress';

interface SelectedClientCardProps {
  clientName: string | null;
  status: ClientStatus | null;
  /** Defaults to router.back() — both flows normally push this screen from the client picker. Ignored when `progress` is set (read-only mode). */
  onChange?: () => void;
  /**
   * 2026-08-09 (Vince bug report — console error "The action 'GO_BACK' was
   * not handled by any navigator"): the default handler used to call
   * `router.back()` unconditionally, which throws when this screen is the
   * first entry in its stack (e.g. cold-start rehydration/deep-link landing
   * directly on Record Meeting — no picker screen underneath to pop to).
   * Callers pass their own `routes.home()` here so the default handler has
   * somewhere safe to go when there's genuinely nothing to go back to.
   */
  fallbackHref?: Href;
  /**
   * Meeting Detail / Client Journey's read-only composition (2026-08-04
   * handoff): when set, this card hides the "Palitan" change action (there
   * is nothing to change on a saved meeting or a history view) and instead
   * renders the wireframe's `progress-summary` bar
   * (Wireframe-Sales-BizLink.html:2076, `aClientProgressPercent`/label
   * pairing in `lib/client-progress.ts::getClientJourneyProgress`) beneath
   * the stage rail.
   */
  progress?: ClientJourneyProgress;
}

/**
 * Record Meeting's selected-company header card — matches
 * Wireframe-Sales-BizLink.html's single `aSelectedCompanyProgressCard()`
 * (lines 1665-1677), shared by BOTH the full form (record.tsx) and the
 * fast path (record-visit.tsx) exactly like the wireframe shares one render
 * function for both. Previously `record.tsx` used a name-only version of
 * this card and `record-visit.tsx` used the unrelated `ClientInfoCard`
 * (Contact Person/Customer Type/Sales Channel) — Meeting-Flow Wireframe
 * Parity Audit 2026-08-03 item 3. Extracted so record.tsx (already near the
 * 300-line file cap) stays under it.
 */
export function SelectedClientCard({ clientName, status, onChange, progress, fallbackHref }: SelectedClientCardProps) {
  const BIZLINK_COLORS = useBizlinkColors();
  const badge = status ? SALES_CLIENT_STATUS_BADGES[status] : null;
  function defaultOnChange(): void {
    if (router.canGoBack()) {
      router.back();
    } else if (fallbackHref) {
      router.replace(fallbackHref);
    }
  }
  return (
    <YStack backgroundColor={BIZLINK_COLORS.card} borderRadius={24} padding={16} marginBottom="$3.5">
      <XStack alignItems="center" gap="$3">
        <Avatar
          initials={(clientName ?? '—').slice(0, 2).toUpperCase()}
          size="sm"
          background={BIZLINK_COLORS.tintA}
          color={BIZLINK_COLORS.ink}
        />
        <YStack flex={1} gap="$1">
          <Text fontFamily={BIZLINK_FONTS.semibold} fontSize={14} color={BIZLINK_COLORS.text}>
            {clientName ?? '—'}
          </Text>
          {badge ? <StatusBadge {...badge} /> : null}
        </YStack>
        {progress ? null : (
          <Pressable
            onPress={onChange ?? defaultOnChange}
            style={{ minHeight: 44, minWidth: 44, alignItems: 'center', justifyContent: 'center' }}
            hitSlop={8}
          >
            <Text fontSize={12.5} fontFamily={BIZLINK_FONTS.semibold} color={BIZLINK_COLORS.brand}>
              Palitan
            </Text>
          </Pressable>
        )}
      </XStack>
      <StageRail status={status} />
      {progress ? (
        <YStack marginTop="$2" gap="$1.5">
          <XStack alignItems="center" gap="$2">
            <ChartNoAxesCombined size={13} color={BIZLINK_COLORS.brand} strokeWidth={1.75} />
            <Text fontSize={11.5} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted} flex={1}>
              {progress.label}
            </Text>
            <Text fontSize={12.5} fontFamily={BIZLINK_FONTS.semibold} color={BIZLINK_COLORS.text}>
              {progress.percent}%
            </Text>
          </XStack>
          <YStack height={6} borderRadius={999} backgroundColor={BIZLINK_COLORS.soft} overflow="hidden">
            <YStack height={6} borderRadius={999} backgroundColor={BIZLINK_COLORS.brand} width={`${progress.percent}%`} />
          </YStack>
        </YStack>
      ) : null}
    </YStack>
  );
}
