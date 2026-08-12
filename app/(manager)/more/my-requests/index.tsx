import { useState } from 'react';
import { ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, type Href } from 'expo-router';
import { ClipboardCheck } from 'lucide-react-native';
import { Spinner, Text, YStack } from 'tamagui';
import { BIZLINK_COLORS, BIZLINK_FONTS } from '../../../../lib/theme';
import { useMyRequestStatuses } from '../../../../lib/use-my-request-statuses';
import type { MyRequestRow, MyRequestStatus } from '../../../../lib/my-request-status-service';
import { usePagination, PAGINATION_PAGE_SIZE } from '../../../../lib/use-pagination';
import { BizTopBar } from '../../../../components/bizlink/BizTopBar';
import { BizButton } from '../../../../components/bizlink/BizButton';
import { BizMyRequestRow } from '../../../../components/bizlink/BizMyRequestRow';
import { BizFilterScroll, type BizFilterOption } from '../../../../components/bizlink/BizFilterScroll';
import { BizFloatingPager } from '../../../../components/bizlink/BizFloatingPager';

type StatusFilterValue = 'all' | MyRequestStatus;
type KindFilterValue = MyRequestRow['requestKind'];

// Same full status union as the Sales/RSR twin (app/(tabs)/more/my-requests/
// index.tsx) — `get_my_request_statuses()` is requester-scoped by
// `current_profile_id()`, so it already returns a Manager's OWN outgoing
// requests (their own tag-along asks, PO confirmations, client edits on a
// client they don't own) with no server change needed.
const STATUS_FILTER_OPTIONS: BizFilterOption<StatusFilterValue>[] = [
  { value: 'all', label: 'All' },
  { value: 'pending', label: 'Pending' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'accepted', label: 'Accepted' },
  { value: 'declined', label: 'Declined' },
  { value: 'cancelled', label: 'Cancelled' },
];

const KIND_FILTER_OPTIONS: BizFilterOption<KindFilterValue>[] = [
  { value: 'po_confirmation', label: 'PO Confirmation' },
  { value: 'client_edit', label: 'Client Edit' },
  { value: 'tag_along', label: 'Tag-Along' },
];

/**
 * Manager twin of the Sales/RSR "My Requests" screen (app/(tabs)/more/
 * my-requests/index.tsx) — added 2026-08-11 because a Manager can now also
 * act as a requester (recording their own client visits via
 * app/(manager)/clients/record-visit.tsx, tagging along on a meeting,
 * submitting a PO confirmation or a client edit on a client they don't
 * own). Before this screen a Manager had no way to see the status of their
 * OWN outgoing requests — only `manager-request-feed-service.ts`'s inbox of
 * requests waiting on THEIR decision. No new service/hook: reuses
 * `lib/my-request-status-service.ts` / `lib/use-my-request-statuses.ts`
 * as-is, since the underlying RPC is scoped to the caller regardless of
 * role.
 */
export default function ManagerMyRequestsScreen() {
  const insets = useSafeAreaInsets();
  const { rows, loading, error, reload } = useMyRequestStatuses();
  const [statusFilter, setStatusFilter] = useState<StatusFilterValue>('all');
  const [kindFilter, setKindFilter] = useState<KindFilterValue | 'all'>('all');

  function handleKindChipPress(kind: KindFilterValue): void {
    setKindFilter((current) => (current === kind ? 'all' : kind));
  }

  const filteredRows = rows.filter((row) => {
    const statusMatches = statusFilter === 'all' || row.status === statusFilter;
    const kindMatches = kindFilter === 'all' || row.requestKind === kindFilter;
    return statusMatches && kindMatches;
  });

  const { page, totalPages, pageItems, setPage } = usePagination(filteredRows, `${statusFilter}|${kindFilter}`);

  return (
    <YStack flex={1} backgroundColor={BIZLINK_COLORS.canvas} paddingTop={insets.top}>
      <BizTopBar title="My Requests" fallbackHref="/(manager)" />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 120 }}>
        <Text fontSize={13} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted} marginBottom="$3" lineHeight={19}>
          The status of your own PO confirmations, client edits, and companion requests.
        </Text>

        <BizFilterScroll options={STATUS_FILTER_OPTIONS} value={statusFilter} onChange={setStatusFilter} />
        <YStack marginTop="$2" marginBottom="$3">
          <BizFilterScroll
            options={KIND_FILTER_OPTIONS}
            value={kindFilter === 'all' ? null : kindFilter}
            onChange={handleKindChipPress}
          />
        </YStack>

        {loading ? (
          <YStack alignItems="center" paddingVertical="$6">
            <Spinner size="large" color={BIZLINK_COLORS.brand} />
          </YStack>
        ) : error ? (
          <YStack alignItems="center" paddingVertical="$6" gap="$3">
            <Text fontSize={13} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted} textAlign="center">
              {error}
            </Text>
            <BizButton small label="Try again" variant="white" onPress={reload} />
          </YStack>
        ) : filteredRows.length === 0 ? (
          <YStack alignItems="center" paddingVertical="$6" gap="$2">
            <ClipboardCheck size={28} color={BIZLINK_COLORS.muted} strokeWidth={1.75} />
            <Text fontSize={13} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted} textAlign="center">
              {rows.length === 0 ? "You have no requests yet." : "No request matches this filter."}
            </Text>
          </YStack>
        ) : (
          pageItems.map((row, index) => (
            <BizMyRequestRow
              key={row.id}
              row={row}
              rowNumber={(page - 1) * PAGINATION_PAGE_SIZE + index + 1}
              onPress={() => router.push(`/(manager)/more/my-requests/${row.id}` as Href)}
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
