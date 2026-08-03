import { useState } from 'react';
import { ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { CircleCheckBig } from 'lucide-react-native';
import { Spinner, Text, YStack } from 'tamagui';
import { BIZLINK_FONTS, useBizlinkColors } from '../../../lib/theme';
import { useManagerApprovalFeed } from '../../../lib/use-manager-approval-feed';
import type { ApprovalDecisionStatus, ApprovalRequestKind } from '../../../lib/manager-approval-feed-service';
import { BizTopBar } from '../../../components/bizlink/BizTopBar';
import { BizButton } from '../../../components/bizlink/BizButton';
import { BizApprovalRow } from '../../../components/bizlink/BizApprovalRow';
import { BizFilterScroll, type BizFilterOption } from '../../../components/bizlink/BizFilterScroll';

type StatusFilterValue = 'all' | ApprovalDecisionStatus;
type KindFilterValue = 'all' | ApprovalRequestKind;

const STATUS_FILTER_OPTIONS: BizFilterOption<StatusFilterValue>[] = [
  { value: 'all', label: 'All' },
  { value: 'pending', label: 'Pending' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
];

// Sprint.md Batch 6 "Manager Approvals Screen — Filter Chips Confirmed
// (2026-08-02)": only these two chips are specified for the request-type row
// (no separate "All" chip) — each chip TOGGLES: tapping a selected chip
// clears the kind filter back to showing both kinds, tapping an unselected
// one narrows to that kind alone.
const KIND_FILTER_OPTIONS: BizFilterOption<ApprovalRequestKind>[] = [
  { value: 'client_edit', label: 'Client Edit' },
  { value: 'po_confirmation', label: 'PO Confirmation' },
];

/**
 * Manager Approvals inbox (Batch 6 PR B, ADR-052). Replaces the wireframe's
 * stale offline-sync-state filter chips (queued/pending/synced,
 * Wireframe-Manager-BizLink.html ~line 1686) with Vince's confirmed status +
 * request-kind chips (Sprint.md "Filter chips (exact)") — decisions here are
 * online-only, so a sync-state filter no longer applies. Deliberately NOT
 * scope-filtered by `managerScope` (ADR-052 section G) — always the
 * manager's full team inbox.
 */
export default function ManagerApprovalsScreen() {
  const BIZLINK_COLORS = useBizlinkColors();
  const insets = useSafeAreaInsets();
  const { rows, loading, error, reload } = useManagerApprovalFeed();
  const [statusFilter, setStatusFilter] = useState<StatusFilterValue>('all');
  const [kindFilter, setKindFilter] = useState<KindFilterValue>('all');

  function handleKindChipPress(kind: ApprovalRequestKind): void {
    setKindFilter((current) => (current === kind ? 'all' : kind));
  }

  const filteredRows = rows.filter((row) => {
    const statusMatches = statusFilter === 'all' || row.status === statusFilter;
    const kindMatches = kindFilter === 'all' || row.requestKind === kindFilter;
    return statusMatches && kindMatches;
  });

  return (
    <YStack flex={1} backgroundColor={BIZLINK_COLORS.canvas} paddingTop={insets.top}>
      <BizTopBar title="Approvals" />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}>
        <Text fontSize={13} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted} marginBottom="$3" lineHeight={19}>
          Client edit at PO confirmation requests ng buong team mo. Ang tag-along ay nasa sarili nitong Tag-Along
          Requests flow.
        </Text>

        <BizFilterScroll options={STATUS_FILTER_OPTIONS} value={statusFilter} onChange={setStatusFilter} />
        <YStack marginTop="$2">
          <BizFilterScroll
            options={KIND_FILTER_OPTIONS}
            value={kindFilter === 'all' ? null : kindFilter}
            onChange={handleKindChipPress}
          />
        </YStack>

        <YStack marginTop="$3">
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
                Walang request sa filter na ito.
              </Text>
            </YStack>
          ) : (
            filteredRows.map((row) => (
              <BizApprovalRow
                key={row.requestId}
                row={row}
                onPress={() => router.push(`/(manager)/approvals/${row.requestId}`)}
              />
            ))
          )}
        </YStack>
      </ScrollView>
    </YStack>
  );
}
