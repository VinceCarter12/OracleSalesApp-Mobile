import { useState } from 'react';
import { Pressable, ScrollView, TextInput } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { CircleCheckBig, Search, SlidersHorizontal } from 'lucide-react-native';
import { Spinner, Text, XStack, YStack } from 'tamagui';
import { BIZLINK_FONTS, BIZLINK_ON_INK, useBizlinkColors } from '../../../lib/theme';
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
import { BizFilterSheet } from '../../../components/bizlink/BizFilterSheet';
import { BizFilterSheetRow } from '../../../components/bizlink/BizFilterSheetRow';
import { BizOfflineNotice } from '../../../components/bizlink/BizOfflineNotice';

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
const KIND_FILTER_OPTIONS: BizFilterOption<KindFilterValue>[] = [
  { value: 'all', label: 'All' },
  { value: 'po_confirmation', label: 'PO Confirmation' },
  { value: 'client_edit', label: 'Client Edit' },
  { value: 'tag_along', label: 'Tag-Along' },
];

const KIND_FILTER_VALUES: readonly ManagerRequestKind[] = ['po_confirmation', 'client_edit', 'tag_along'];

function isManagerRequestKind(value: string | string[] | undefined): value is ManagerRequestKind {
  return typeof value === 'string' && (KIND_FILTER_VALUES as readonly string[]).includes(value);
}

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
  const { rows, loading, error, offline, reload } = useManagerRequestFeed(profileId);
  // Manager Notifications' Tag-Along item taps in here with `?kind=tag_along`
  // so the merged inbox opens pre-filtered (2026-08-16) — read once as the
  // initial state, same as any other deep-link-style entry param in this
  // app; the in-screen Filters chips still fully control it afterward.
  const { kind: initialKindParam } = useLocalSearchParams<{ kind?: string }>();
  const [statusFilter, setStatusFilter] = useState<StatusFilterValue>('pending');
  const [kindFilter, setKindFilter] = useState<KindFilterValue>(() =>
    isManagerRequestKind(initialKindParam) ? initialKindParam : 'all'
  );
  const [search, setSearch] = useState('');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [respondingId, setRespondingId] = useState<string | null>(null);
  const [respondError, setRespondError] = useState<string | null>(null);

  function handleKindChipPress(kind: KindFilterValue): void {
    setKindFilter((current) => (current === kind ? 'all' : kind));
  }

  const normalizedSearch = search.trim().toLowerCase();
  const filteredRows = rows.filter((row) => {
    const statusMatches = statusFilter === 'all' || row.status === statusFilter;
    const kindMatches = kindFilter === 'all' || row.kind === kindFilter;
    const searchMatches = !normalizedSearch || [row.clientName, row.requesterName, row.summary]
      .some((value) => value.toLowerCase().includes(normalizedSearch));
    return statusMatches && kindMatches && searchMatches;
  });

  const { page, totalPages, pageItems, setPage } = usePagination(filteredRows, `${statusFilter}|${kindFilter}|${normalizedSearch}`);
  const filtersActive = statusFilter !== 'pending' || kindFilter !== 'all';

  function resetFilters(): void {
    setStatusFilter('pending');
    setKindFilter('all');
  }

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
          Client edit, PO confirmation, and companion requests from your whole team — all in one inbox.
        </Text>
        <Text fontSize={13} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted} marginBottom="$3" lineHeight={19}>
          You no longer create your own meeting record. The sales rep records the whole client visit
          (you appear in their photo as proof) — here you only confirm that you joined.
        </Text>

        <XStack gap="$2" marginBottom="$3">
          <XStack flex={1} height={52} alignItems="center" gap="$2" paddingHorizontal={14} backgroundColor={BIZLINK_COLORS.card} borderRadius={16}>
            <Search size={17} color={BIZLINK_COLORS.muted} strokeWidth={1.75} />
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder="Search client or requester..."
              placeholderTextColor={BIZLINK_COLORS.muted}
              autoCapitalize="none"
              style={{ flex: 1, fontFamily: BIZLINK_FONTS.medium, fontSize: 13, color: BIZLINK_COLORS.text }}
            />
          </XStack>
          <Pressable
            accessibilityLabel="Open request filters"
            onPress={() => setFiltersOpen(true)}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 52, borderRadius: 16, paddingHorizontal: 14, backgroundColor: filtersActive ? BIZLINK_COLORS.ink : BIZLINK_COLORS.card, borderWidth: 1, borderColor: filtersActive ? BIZLINK_COLORS.ink : BIZLINK_COLORS.line }}
          >
            <SlidersHorizontal size={16} color={filtersActive ? BIZLINK_ON_INK.solid : BIZLINK_COLORS.muted} strokeWidth={1.75} />
            <Text fontSize={11.5} fontFamily={BIZLINK_FONTS.medium} color={filtersActive ? BIZLINK_ON_INK.solid : BIZLINK_COLORS.muted}>Filters</Text>
          </Pressable>
        </XStack>

        {respondError ? (
          <Text fontSize={12.5} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.red} marginBottom="$2">
            {respondError}
          </Text>
        ) : null}

        {loading ? (
          <YStack alignItems="center" paddingVertical="$6">
            <Spinner size="large" color={BIZLINK_COLORS.brand} />
          </YStack>
        ) : offline && error ? (
          <YStack paddingVertical="$4" gap="$3">
            <BizOfflineNotice message={error} />
            <BizButton small label="Try again" variant="white" onPress={reload} />
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
            <CircleCheckBig size={28} color={BIZLINK_COLORS.muted} strokeWidth={1.75} />
            <Text fontSize={13} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted} textAlign="center">
              {rows.length === 0 ? 'You have no requests yet.' : 'No request matches your search or filters.'}
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

      <BizFilterSheet visible={filtersOpen} onClose={() => setFiltersOpen(false)} filtersActive={filtersActive} onReset={resetFilters}>
        <BizFilterSheetRow label="Status" value={STATUS_FILTER_OPTIONS.find((option) => option.value === statusFilter)?.label ?? 'All'}>
          <BizFilterScroll options={STATUS_FILTER_OPTIONS} value={statusFilter} onChange={setStatusFilter} />
        </BizFilterSheetRow>
        <BizFilterSheetRow label="Request type" value={kindFilter === 'all' ? 'All types' : KIND_FILTER_OPTIONS.find((option) => option.value === kindFilter)?.label ?? 'All types'}>
          <BizFilterScroll options={KIND_FILTER_OPTIONS} value={kindFilter} onChange={handleKindChipPress} />
        </BizFilterSheetRow>
      </BizFilterSheet>
    </YStack>
  );
}
