import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, TextInput } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { CircleCheckBig, ListChecks, Search, SlidersHorizontal } from 'lucide-react-native';
import { Spinner, Text, XStack, YStack } from 'tamagui';
import { BIZLINK_FONTS, BIZLINK_ON_INK, useBizlinkColors } from '../../../lib/theme';
import { useSession } from '../../../lib/session-store';
import { useManagerRequestFeed } from '../../../lib/use-manager-request-feed';
import type { ManagerRequestKind, ManagerRequestRow } from '../../../lib/manager-request-feed-service';
import type { ApprovalDecisionStatus } from '../../../lib/manager-approval-feed-service';
import { updateCompanionRequestStatus, StaleCompanionRequestError } from '../../../lib/tag-along-invitee-service';
import { approveClientEditRequests } from '../../../lib/client-edit-decision-service';
import { describeConflictReason, describeDecisionFailure } from '../../../lib/policies/approval-decision-outcome';
import {
  isBulkApprovable,
  isLockedBySelection,
  resolveBulkSelection,
  type BulkSelectableRequest,
} from '../../../lib/policies/bulk-approval-selection';
import { isLikelyOnline } from '../../../lib/sync/connectivity';
import { showToast } from '../../../lib/toast';
import { usePagination, PAGINATION_PAGE_SIZE } from '../../../lib/use-pagination';
import { BizTopBar } from '../../../components/bizlink/BizTopBar';
import { BizButton } from '../../../components/bizlink/BizButton';
import { BizManagerRequestRow } from '../../../components/bizlink/BizManagerRequestRow';
import { BizFilterScroll, type BizFilterOption } from '../../../components/bizlink/BizFilterScroll';
import { BizFloatingPager } from '../../../components/bizlink/BizFloatingPager';
import { BizFilterSheet } from '../../../components/bizlink/BizFilterSheet';
import { BizFilterSheetRow } from '../../../components/bizlink/BizFilterSheetRow';
import { BizOfflineNotice } from '../../../components/bizlink/BizOfflineNotice';
import { BizSelectionBar } from '../../../components/bizlink/BizSelectionBar';

type StatusFilterValue = 'all' | ApprovalDecisionStatus;
type KindFilterValue = 'all' | ManagerRequestKind;

// Every row in `useManagerRequestFeed()` is pending/approved/rejected — a
// decided tag-along drops out of the feed entirely (same as the old
// `app/(manager)/tag-along.tsx`), so `accepted`/`declined` never actually
// occur here even though `RemoteTagAlongStatus` has them; no chip is added
// for a status this feed can never produce.
type StatusCounts = Record<StatusFilterValue, number>;

/**
 * Status chips, each carrying how many requests sit behind it.
 *
 * The count is the point (Adrian, device test 2026-08-31: "the total of that
 * pending approvals, there no such thing on that page"). Before this the
 * screen never said how much work was waiting anywhere — the pager shows a
 * page number, and ADR-064 tints every PENDING row green, which is no help
 * when you cannot see how many rows there are in total or how many of them
 * are still yours to decide.
 *
 * Counts are computed against everything EXCEPT the status filter, so a chip
 * always predicts exactly what tapping it yields. Counting the fully-filtered
 * set instead would make every unselected chip read 0.
 */
function buildStatusOptions(counts: StatusCounts): BizFilterOption<StatusFilterValue>[] {
  return [
    { value: 'all', label: `All ${counts.all}` },
    { value: 'pending', label: `Pending ${counts.pending}` },
    { value: 'approved', label: `Approved ${counts.approved}` },
    { value: 'rejected', label: `Rejected ${counts.rejected}` },
  ];
}

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
  // Filed-by filter. Keyed on profile id, never on name — see the note on
  // ManagerRequestRow.requesterId. 'all' is the unset state.
  const [agentFilter, setAgentFilter] = useState<string>('all');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [respondingId, setRespondingId] = useState<string | null>(null);
  const [respondError, setRespondError] = useState<string | null>(null);

  /**
   * Bulk approve (2026-08-31, Adrian) — the mobile half of the same feature on
   * web's `/approvals`. Client edits only, one agent at a time; the reasoning
   * for both narrowings lives in `lib/policies/bulk-approval-selection.ts`.
   *
   * `selecting` is separate from "something is ticked" so the mode can be
   * entered deliberately from the Select pill and stay on after the last tick
   * is removed — otherwise clearing the final row would silently make every
   * card navigate again, and the next tap would open a detail screen the
   * manager did not ask for.
   */
  const [selecting, setSelecting] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [approving, setApproving] = useState(false);
  // The selection bar's real rendered height, reported by its own onLayout.
  // Both the pager's lift and the list's bottom padding derive from it, so
  // neither is a magic number that goes stale when the bar's content changes.
  // Seeded at 0 and applied only once a selection exists, so nothing shifts
  // before the bar has ever been on screen.
  const [barHeight, setBarHeight] = useState(0);
  // Decisions are online-only, exactly as `approvals/[id].tsx` has them —
  // ADR-052 section E/F, correcting the wireframe's offline queuing.
  const [online, setOnline] = useState(true);

  const checkOnline = useCallback(() => {
    isLikelyOnline().then(setOnline);
  }, []);

  useEffect(() => { checkOnline(); }, [checkOnline]);
  useFocusEffect(useCallback(() => { checkOnline(); }, [checkOnline]));

  function handleKindChipPress(kind: KindFilterValue): void {
    setKindFilter((current) => (current === kind ? 'all' : kind));
  }

  const normalizedSearch = search.trim().toLowerCase();

  /**
   * Facet counting: every chip counts against the rows matching all the OTHER
   * filters, never against the fully-filtered set. Count the fully-filtered
   * set and each unselected chip reads 0, which is worse than no count — a
   * chip has to predict what tapping it actually yields.
   */
  const matchesSearchKind = (row: ManagerRequestRow): boolean => {
    const kindMatches = kindFilter === 'all' || row.kind === kindFilter;
    const searchMatches = !normalizedSearch || [row.clientName, row.requesterName, row.summary]
      .some((value) => value.toLowerCase().includes(normalizedSearch));
    return kindMatches && searchMatches;
  };
  const matchesStatus = (row: ManagerRequestRow): boolean =>
    statusFilter === 'all' || row.status === statusFilter;
  const matchesAgent = (row: ManagerRequestRow): boolean =>
    agentFilter === 'all' || row.requesterId === agentFilter;

  const searchKindRows = rows.filter(matchesSearchKind);
  const filteredRows = searchKindRows.filter((row) => matchesStatus(row) && matchesAgent(row));
  const forStatusCounts = searchKindRows.filter(matchesAgent);
  const forAgentCounts = searchKindRows.filter(matchesStatus);

  const statusCounts: StatusCounts = {
    all: forStatusCounts.length,
    pending: forStatusCounts.filter((row) => row.status === 'pending').length,
    approved: forStatusCounts.filter((row) => row.status === 'approved').length,
    rejected: forStatusCounts.filter((row) => row.status === 'rejected').length,
  };
  const statusOptions = buildStatusOptions(statusCounts);

  /**
   * Agents, built from the requests themselves rather than the team roster —
   * this screen can only filter to someone who has actually filed something,
   * and offering the rest is offering guaranteed-empty results. Same rule the
   * web Approvals page uses for its requester picker.
   *
   * An agent whose current count is 0 is dropped so flipping status doesn't
   * leave a row of dead chips, EXCEPT the one currently selected — losing your
   * own selection out from under you is worse than one 0 chip.
   */
  const agentOptions = (() => {
    const counts = new Map<string, { name: string; count: number }>();
    for (const row of searchKindRows) {
      const entry = counts.get(row.requesterId) ?? { name: row.requesterName, count: 0 };
      entry.name = row.requesterName;
      counts.set(row.requesterId, entry);
    }
    for (const row of forAgentCounts) {
      const entry = counts.get(row.requesterId);
      if (entry) entry.count += 1;
    }
    const options = [...counts.entries()]
      .filter(([id, entry]) => entry.count > 0 || id === agentFilter)
      .sort((a, b) => a[1].name.localeCompare(b[1].name))
      .map(([id, entry]) => ({ value: id, label: `${entry.name} ${entry.count}` }));
    return [{ value: 'all', label: `All agents ${forAgentCounts.length}` }, ...options];
  })();

  const { page, totalPages, pageItems, setPage } = usePagination(filteredRows, `${statusFilter}|${kindFilter}|${agentFilter}|${normalizedSearch}`);
  // 'pending' is this screen's resting state (65ce8ee), not 'all' — so it is
  // the status value that does NOT count as an active filter.
  const filtersActive = statusFilter !== 'pending' || kindFilter !== 'all' || agentFilter !== 'all';

  // Resolved against the FILTERED rows, not `pageItems`: "Select all 7" has to
  // mean all seven, including the four on page two. `selectedIds` is never
  // pruned by an effect — the intersection happens here on every render, so a
  // filter change or an admin deciding a request on web drops it from the
  // selection with no chance of the two states disagreeing.
  const selectableRows: BulkSelectableRequest[] = filteredRows.map((row) => ({
    requestId: row.requestId,
    kind: row.kind,
    status: row.status,
    // Tag-alongs carry a real requesterId too, but `isBulkApprovable` gates
    // on kind, so they stay out of a batch regardless.
    requesterId: row.requesterId,
    requesterName: row.requesterName,
  }));
  const selection = resolveBulkSelection(selectableRows, selectedIds);
  const selectedLookup = new Set(selection.selectedIds);
  const anyApprovable = selectableRows.some(isBulkApprovable);

  function resetFilters(): void {
    setStatusFilter('pending');
    setKindFilter('all');
    setAgentFilter('all');
  }

  function exitSelection(): void {
    setSelecting(false);
    setSelectedIds([]);
  }

  function toggleSelected(requestId: string): void {
    setSelectedIds((current) =>
      current.includes(requestId) ? current.filter((id) => id !== requestId) : [...current, requestId]
    );
  }

  /**
   * Approve every ticked request.
   *
   * `approveClientEditRequests()` returns both lists because partial success
   * is the normal outcome, not an edge case — see its own note. What survives
   * the run is the useful part: the failures STAY TICKED, so once the toast
   * clears, the rows still selected are exactly the ones needing another look.
   * A fully clean run leaves nothing selected and closes selection mode.
   */
  async function approveSelected(): Promise<void> {
    const ids = selection.selectedIds;
    if (ids.length === 0 || approving) return;
    // Captured before the await — `reload()` replaces the rows this is derived from.
    const agentName = selection.requesterName ?? 'this agent';

    setApproving(true);
    setRespondError(null);
    try {
      const { approved, failures } = await approveClientEditRequests(ids);
      setSelectedIds(failures.map((failure) => failure.requestId));

      if (failures.length === 0) {
        setSelecting(false);
        showToast(`Approved ${approved.length} request${approved.length === 1 ? '' : 's'} from ${agentName}.`);
      } else {
        // Distinct reasons, not one line per request: the failures are still
        // ticked on screen, so this has to answer "why", not "which".
        // A 'base_conflict' covers three unrelated causes, so it gets the
        // specific sentence migration 128 makes available; every other code
        // keeps its short phrase. De-duplicated either way, because the rows
        // are still ticked on screen and this has to answer "why", not "which".
        const reasons = [
          ...new Set(
            failures.map((failure) =>
              failure.code === 'base_conflict'
                ? describeConflictReason(failure.conflictDetail ?? null)
                : describeDecisionFailure(failure.code)
            )
          ),
        ].join('; ');
        showToast(
          approved.length > 0
            ? `${approved.length} approved, ${failures.length} skipped — ${reasons}.`
            : `Couldn't approve ${failures.length} — ${reasons}.`
        );
      }
      await reload();
    } catch (err) {
      setRespondError(err instanceof Error ? err.message : "The approvals couldn't be processed. Try again.");
    } finally {
      setApproving(false);
    }
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
      {/* Extra bottom padding while the selection bar is up, so the last row
          can still be scrolled clear of both it and the pager sitting above
          it. 120 is the pager's own clearance, unchanged from before. */}
      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingBottom: 120 + (selection.selectedIds.length > 0 ? barHeight + 24 : 0),
        }}
      >
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

        {/* Status as an always-visible strip, not only inside the Filters
            sheet — the same shape Manager Notifications uses for its quick
            filters while keeping the full set in its own sheet. A count
            buried behind a sheet answers "how much is waiting?" only for
            someone who already went looking, which is exactly the person who
            did not need telling. */}
        <YStack marginBottom="$3">
          <BizFilterScroll options={statusOptions} value={statusFilter} onChange={setStatusFilter} />
        </YStack>

        {/* Only offered when there is something it could act on — a Select
            pill above an inbox of nothing but PO and tag-along rows is a
            control that can do nothing when tapped.
            
            Once a row is ticked the floating bar owns the ✕, so the pill
            hides: exactly one way out of selection mode at any moment, never
            two competing cancels. But selection mode with NOTHING ticked
            shows no bar, so the pill has to become that exit itself —
            otherwise entering the mode and changing your mind would strand
            every row un-navigable with no way back. */}
        {anyApprovable && (!selecting || selection.selectedIds.length === 0) ? (
          <Pressable
            accessibilityLabel={selecting ? 'Cancel selection' : 'Select client edits to approve together'}
            onPress={() => (selecting ? exitSelection() : setSelecting(true))}
            style={{ flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 6, minHeight: 40, borderRadius: 999, paddingHorizontal: 14, marginBottom: 12, backgroundColor: selecting ? BIZLINK_COLORS.ink : BIZLINK_COLORS.card, borderWidth: 1, borderColor: selecting ? BIZLINK_COLORS.ink : BIZLINK_COLORS.line }}
          >
            <ListChecks size={15} color={selecting ? BIZLINK_ON_INK.solid : BIZLINK_COLORS.muted} strokeWidth={1.75} />
            <Text fontSize={11.5} fontFamily={BIZLINK_FONTS.medium} color={selecting ? BIZLINK_ON_INK.solid : BIZLINK_COLORS.muted}>
              {selecting ? 'Tap the client edits to approve · Cancel' : 'Select to approve'}
            </Text>
          </Pressable>
        ) : null}

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
          pageItems.map((row, index) => {
            const asSelectable = selectableRows.find((candidate) => candidate.requestId === row.requestId)!;
            return (
              <BizManagerRequestRow
                key={row.requestId}
                row={row}
                rowNumber={(page - 1) * PAGINATION_PAGE_SIZE + index + 1}
                onPress={() => router.push(`/(manager)/approvals/${row.requestId}`)}
                onAccept={() => respond(row, 'accepted')}
                onDecline={() => respond(row, 'declined')}
                responding={respondingId === row.requestId}
                selecting={selecting}
                selectable={isBulkApprovable(asSelectable)}
                selected={selectedLookup.has(row.requestId)}
                locked={isLockedBySelection(asSelectable, selection)}
                onToggleSelect={() => toggleSelected(row.requestId)}
              />
            );
          })
        )}
      </ScrollView>

      {/* The pager lifts clear of the selection bar rather than stacking under
          it — selection deliberately spans pages, so both have to stay usable
          at once. The lift is the bar's MEASURED height plus a 12px gap, not a
          constant: the bar grows and shrinks with the "Select all" pill and
          the offline helper line. */}
      {filteredRows.length > 0 ? (
        <BizFloatingPager
          page={page}
          totalPages={totalPages}
          onPageChange={setPage}
          bottomOffset={insets.bottom + 16 + (selection.selectedIds.length > 0 ? barHeight + 12 : 0)}
        />
      ) : null}

      {selection.selectedIds.length > 0 && selection.requesterName ? (
        <BizSelectionBar
          count={selection.selectedIds.length}
          requesterName={selection.requesterName}
          eligibleCount={selection.eligibleIds.length}
          onSelectAll={() => setSelectedIds(selection.eligibleIds)}
          onClear={exitSelection}
          onConfirm={approveSelected}
          confirmLabel={`Approve ${selection.selectedIds.length}`}
          busy={approving}
          busyLabel="Approving…"
          disabled={!online}
          helperText={online ? null : 'Online-only decision. Gagana kapag may signal.'}
          bottomOffset={insets.bottom + 16}
          onHeightChange={setBarHeight}
        />
      ) : null}

      <BizFilterSheet visible={filtersOpen} onClose={() => setFiltersOpen(false)} filtersActive={filtersActive} onReset={resetFilters}>
        <BizFilterSheetRow label="Status" value={statusOptions.find((option) => option.value === statusFilter)?.label ?? 'All'}>
          <BizFilterScroll options={statusOptions} value={statusFilter} onChange={setStatusFilter} />
        </BizFilterSheetRow>
        <BizFilterSheetRow label="Request type" value={kindFilter === 'all' ? 'All types' : KIND_FILTER_OPTIONS.find((option) => option.value === kindFilter)?.label ?? 'All types'}>
          <BizFilterScroll options={KIND_FILTER_OPTIONS} value={kindFilter} onChange={handleKindChipPress} />
        </BizFilterSheetRow>
        {/* Filed by. Lives in the sheet rather than as a second always-on
            strip — status earns the inline slot because it is the triage
            axis, and two stacked chip rows above the list would push the
            first card off a phone screen. Pairs directly with bulk approve,
            which is locked to one agent anyway: narrow to an agent here, then
            "Select all N" clears their whole queue in two taps. */}
        <BizFilterSheetRow
          label="Agent"
          value={agentOptions.find((option) => option.value === agentFilter)?.label ?? 'All agents'}
        >
          <BizFilterScroll options={agentOptions} value={agentFilter} onChange={setAgentFilter} />
        </BizFilterSheetRow>
      </BizFilterSheet>
    </YStack>
  );
}
