import { useState } from 'react';
import { ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
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

// `MyRequestStatus` (lib/my-request-status-service.ts) is the RPC's full
// status union shared across all three request kinds — po_confirmation and
// client_edit resolve to pending/approved/rejected, tag_along resolves to
// pending/accepted/declined, and cancelled can occur on any kind (requester
// cancels their own pending request). All six are real, reachable statuses,
// so unlike Approvals (which is Manager-decision-only, no cancelled) every
// status gets a chip here.
const STATUS_FILTER_OPTIONS: BizFilterOption<StatusFilterValue>[] = [
  { value: 'all', label: 'All' },
  { value: 'pending', label: 'Pending' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'accepted', label: 'Accepted' },
  { value: 'declined', label: 'Declined' },
  { value: 'cancelled', label: 'Cancelled' },
];

// Same toggle pattern as `app/(manager)/approvals/index.tsx`'s kind row: no
// "All" chip, tapping a selected chip clears back to showing every kind.
const KIND_FILTER_OPTIONS: BizFilterOption<KindFilterValue>[] = [
  { value: 'po_confirmation', label: 'PO Confirmation' },
  { value: 'client_edit', label: 'Client Edit' },
  { value: 'tag_along', label: 'Tag-Along' },
];

/**
 * Wireframe `a-myrequests` (Wireframe-Sales-BizLink.html ~line 887,
 * `aRenderMyRequests()` ~line 1199): requester-scoped, read-only mirror of
 * `get_my_request_statuses()` covering PO confirmation, client edit, and
 * tag-along requests. No approve/decline action here — the Manager decides,
 * this screen only shows the outcome.
 *
 * Filter chips + pagination (2026-08-09) are new scope beyond the wireframe
 * (`#a-myrequests` has no filter/pager markup), same precedent as the
 * Manager Approvals screen's chips — see Sprint.md / My-Requests-Page-
 * Handoff-2026-08-08.md.
 */
export default function MyRequestsScreen() {
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
      <BizTopBar title="My Requests" fallbackHref="/(tabs)" />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 120 }}>
        <Text fontSize={13} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted} marginBottom="$3" lineHeight={19}>
          The status of your PO confirmations, client edits, and companion requests. View-only: the Manager is the only
          one who decides.
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
              onPress={() => router.push(`/(tabs)/more/my-requests/${row.id}`)}
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
