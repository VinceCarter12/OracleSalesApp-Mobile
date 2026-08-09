import { useState } from 'react';
import { ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { CircleCheckBig } from 'lucide-react-native';
import { Spinner, Text, YStack } from 'tamagui';
import { BIZLINK_FONTS, useBizlinkColors } from '../../../lib/theme';
import { useSession } from '../../../lib/session-store';
import { useManagerRequestFeed } from '../../../lib/use-manager-request-feed';
import type { ManagerRequestKind, ManagerRequestRow } from '../../../lib/manager-request-feed-service';
import type { ApprovalDecisionStatus } from '../../../lib/manager-approval-feed-service';
import { updateCompanionRequestStatus, StaleCompanionRequestError } from '../../../lib/tag-along-invitee-service';
import { usePagination, PAGINATION_PAGE_SIZE } from '../../../lib/use-pagination';
import { BizTopBar } from '../../../components/bizlink/BizTopBar';
import { BizButton } from '../../../components/bizlink/BizButton';
import { BizManagerRequestRow } from '../../../components/bizlink/BizManagerRequestRow';
import { BizFilterScroll, type BizFilterOption } from '../../../components/bizlink/BizFilterScroll';
import { BizFloatingPager } from '../../../components/bizlink/BizFloatingPager';

type StatusFilterValue = 'all' | ApprovalDecisionStatus;
type KindFilterValue = 'all' | ManagerRequestKind;

// Every row in `useManagerRequestFeed()` is pending/approved/rejected — a
// decided tag-along drops out of the feed entirely (same as the old
// `app/(manager)/tag-along.tsx`), so `accepted`/`declined` never actually
// occur here even though `RemoteTagAlongStatus` has them; no chip is added
// for a status this feed can never produce.
const STATUS_FILTER_OPTIONS: BizFilterOption<StatusFilterValue>[] = [
  { value: 'all', label: 'All' },
  { value: 'pending', label: 'Pending' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
];

// Same toggle pattern as Sales' My Requests kind row (`app/(tabs)/more/my-requests/index.tsx`):
// no "All" chip, tapping a selected chip clears back to showing every kind.
const KIND_FILTER_OPTIONS: BizFilterOption<ManagerRequestKind>[] = [
  { value: 'po_confirmation', label: 'PO Confirmation' },
  { value: 'client_edit', label: 'Client Edit' },
  { value: 'tag_along', label: 'Tag-Along' },
];

/**
 * Manager Requests inbox (design-only merge, 2026-08-10) — combines the
 * former `app/(manager)/approvals/index.tsx` (client_edit + po_confirmation,
 * ADR-052) and `app/(manager)/tag-along.tsx` (accept/decline invitee feed,
 * B-053) into one screen, copying the filter-chip + pagination pattern Sales'
 * "My Requests" already established for the equivalent 3-kind merge
 * (`app/(tabs)/more/my-requests/index.tsx`). Route path is unchanged
 * (`/(manager)/approvals`) — `approvals/[id].tsx` still owns the
 * client_edit/po_confirmation Approve/Reject detail flow, untouched.
 * Deliberately NOT scope-filtered by `managerScope`/`BizScopeFilter`
 * (ADR-052 section G) — always the manager's full-team inbox, same as
 * before the merge.
 */
export default function ManagerRequestsScreen() {
  const BIZLINK_COLORS = useBizlinkColors();
  const insets = useSafeAreaInsets();
  const { profileId } = useSession();
  const { rows, loading, error, reload } = useManagerRequestFeed(profileId);
  const [statusFilter, setStatusFilter] = useState<StatusFilterValue>('all');
  const [kindFilter, setKindFilter] = useState<KindFilterValue>('all');
  const [respondingId, setRespondingId] = useState<string | null>(null);
  const [respondError, setRespondError] = useState<string | null>(null);

  function handleKindChipPress(kind: ManagerRequestKind): void {
    setKindFilter((current) => (current === kind ? 'all' : kind));
  }

  const filteredRows = rows.filter((row) => {
    const statusMatches = statusFilter === 'all' || row.status === statusFilter;
    const kindMatches = kindFilter === 'all' || row.kind === kindFilter;
    return statusMatches && kindMatches;
  });

  const { page, totalPages, pageItems, setPage } = usePagination(filteredRows, `${statusFilter}|${kindFilter}`);

  // Same accept/decline write-back as the retired `tag-along.tsx`: on
  // success the row disappears from `rows` on the next `reload()` (only
  // pending tag-alongs are ever included), on a stale/already-decided
  // request it silently reloads instead of surfacing an error (race-safe).
  async function respond(row: ManagerRequestRow, decision: 'accepted' | 'declined'): Promise<void> {
    if (row.kind !== 'tag_along' || !profileId) return;
    setRespondingId(row.requestId);
    setRespondError(null);
    try {
      await updateCompanionRequestStatus({ requestId: row.requestId, actorProfileId: profileId, decision });
      await reload();
    } catch (err) {
      if (err instanceof StaleCompanionRequestError) {
        await reload();
      } else {
        setRespondError(err instanceof Error ? err.message : String(err));
      }
    } finally {
      setRespondingId(null);
    }
  }

  return (
    <YStack flex={1} backgroundColor={BIZLINK_COLORS.canvas} paddingTop={insets.top}>
      <BizTopBar title="Requests" fallbackHref="/(manager)" />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 120 }}>
        <Text fontSize={13} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted} marginBottom="$2" lineHeight={19}>
          Client edit, PO confirmation, at tag-along requests ng buong team mo — lahat dito na sa isang inbox.
        </Text>
        <Text fontSize={13} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted} marginBottom="$3" lineHeight={19}>
          Hindi ka na gumagawa ng sariling meeting record. Ang sales rep ang nagre-record ng buong client visit
          (kasama ka sa litrato niya bilang proof) — dito mo lang ito ku-kumpirmahin na sumama ka.
        </Text>

        <BizFilterScroll options={STATUS_FILTER_OPTIONS} value={statusFilter} onChange={setStatusFilter} />
        <YStack marginTop="$2" marginBottom="$3">
          <BizFilterScroll
            options={KIND_FILTER_OPTIONS}
            value={kindFilter === 'all' ? null : kindFilter}
            onChange={handleKindChipPress}
          />
        </YStack>

        {respondError ? (
          <Text fontSize={12.5} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.red} marginBottom="$2">
            {respondError}
          </Text>
        ) : null}

        {loading ? (
          <YStack alignItems="center" paddingVertical="$6">
            <Spinner size="large" color={BIZLINK_COLORS.brand} />
          </YStack>
        ) : error ? (
          <YStack alignItems="center" paddingVertical="$6" gap="$3">
            <Text fontSize={13} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted} textAlign="center">
              {error}
            </Text>
            <BizButton small label="Ulitin" variant="white" onPress={reload} />
          </YStack>
        ) : filteredRows.length === 0 ? (
          <YStack alignItems="center" paddingVertical="$6" gap="$2">
            <CircleCheckBig size={28} color={BIZLINK_COLORS.muted} strokeWidth={1.75} />
            <Text fontSize={13} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted} textAlign="center">
              {rows.length === 0 ? 'Wala kang naghihintay na request.' : 'Walang request sa filter na ito.'}
            </Text>
          </YStack>
        ) : (
          pageItems.map((row, index) => (
            <BizManagerRequestRow
              key={row.requestId}
              row={row}
              rowNumber={(page - 1) * PAGINATION_PAGE_SIZE + index + 1}
              onPress={() => router.push(`/(manager)/approvals/${row.requestId}`)}
              onAccept={() => respond(row, 'accepted')}
              onDecline={() => respond(row, 'declined')}
              responding={respondingId === row.requestId}
            />
          ))
        )}
      </ScrollView>

      {filteredRows.length > 0 ? (
        <BizFloatingPager page={page} totalPages={totalPages} onPageChange={setPage} bottomOffset={insets.bottom + 16} />
      ) : null}
    </YStack>
  );
}
