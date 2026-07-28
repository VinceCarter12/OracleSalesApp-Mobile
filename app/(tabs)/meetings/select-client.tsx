import { useCallback, useMemo, useState } from 'react';
import { FlatList, Pressable, RefreshControl } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { Spinner, Text, XStack, YStack } from 'tamagui';
import { BIZLINK_COLORS, BIZLINK_FONTS } from '../../../lib/theme';
import { useClients } from '../../../lib/useClients';
import { SALES_CLIENT_STATUS_BADGES, getClientStatus, isFastPathEligible } from '../../../lib/client-status';
import { BizTopBar } from '../../../components/bizlink/BizTopBar';
import { StatusBadge } from '../../../components/ui/StatusBadge';
import { BizChip } from '../../../components/bizlink/BizChip';
import type { Client, ClientStatus } from '../../../types';

// Record-picker status filter (Wireframe-Sales-BizLink.html #a-record,
// aRecordPickerFilter/aRenderRecordPicker). Pure UI filter/hint over the
// already-loaded client list.
//
// ADR-042 follow-up (2026-07-28, verified against the wireframe directly):
// `openRecordFlow`/`ClientRow`'s hint below route via `isFastPathEligible`
// (new/existing whitelist), matching `Wireframe-Sales-BizLink.html:1590`
// exactly — an in_progress client reached via the 'all' filter now
// correctly gets the full form instead of being misrouted to the fast path.
// The filter chip list and default now also match the wireframe's own
// `aRecordPickerFilter` initial value (`var aRecordPickerFilter='all'`,
// line 1549) and its `statuses` array (line 1574: `[['all','All'],
// ['prospect','Prospect'],['in_progress','In Progress'],['new','New'],
// ['existing','Existing']]`) — 'existing' was both the wrong default and
// missing the 'in_progress' chip before this fix.
type RecordPickerFilter = ClientStatus | 'all';
const RECORD_PICKER_FILTERS: Array<{ value: RecordPickerFilter; label: string }> = [
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
function openRecordFlow(client: Client): void {
  if (isFastPathEligible(client)) {
    router.push(`/(tabs)/meetings/record-visit?clientId=${client.id}`);
  } else {
    router.push(`/(tabs)/meetings/record?clientId=${client.id}`);
  }
}

function ClientRow({ client }: { client: Client }) {
  const status = getClientStatus(client);
  const badge = SALES_CLIENT_STATUS_BADGES[status];
  const hint = recordPickerHint(status);
  return (
    <Pressable onPress={() => openRecordFlow(client)}>
      <XStack
        alignItems="center"
        justifyContent="space-between"
        backgroundColor={BIZLINK_COLORS.card}
        borderRadius={20}
        padding={16}
        marginBottom={10}
      >
        <YStack gap="$0.5" flex={1}>
          <Text fontFamily={BIZLINK_FONTS.semibold} fontSize={14} color={BIZLINK_COLORS.text}>{client.company_name}</Text>
          <Text fontSize={11.5} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted}>{hint}</Text>
        </YStack>
        <StatusBadge {...badge} />
      </XStack>
    </Pressable>
  );
}

export default function SelectClientScreen() {
  const insets = useSafeAreaInsets();
  const { clients, loading, refresh } = useClients();
  // Wireframe-Sales-BizLink.html:1549 — `var aRecordSelectedClientId = null,
  // aRecordPickerFilter = 'all';` — default filter is 'all', not 'existing'.
  const [statusFilter, setStatusFilter] = useState<RecordPickerFilter>('all');

  // Without this, a client created via Create Client (or completed via
  // Complete Info) never shows up here until a manual pull-to-refresh or app
  // restart — useClients() only fetches once on mount, and this screen can
  // stay mounted across navigations.
  useFocusEffect(useCallback(() => { refresh(); }, [refresh]));

  const filtered = useMemo(
    () => (statusFilter === 'all' ? clients : clients.filter((c) => getClientStatus(c) === statusFilter)),
    [clients, statusFilter]
  );

  return (
    <YStack flex={1} backgroundColor={BIZLINK_COLORS.canvas} paddingTop={insets.top}>
      <BizTopBar title="Record Meeting" />
      <YStack paddingHorizontal="$4" paddingBottom="$2" gap="$1">
        <Text fontSize={13} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted}>
          New at Existing clients go straight to photo capture — no form to re-fill.
        </Text>
      </YStack>

      <XStack paddingHorizontal="$4" gap="$2" flexWrap="wrap" marginBottom="$2.5">
        {RECORD_PICKER_FILTERS.map((f) => (
          <BizChip
            key={f.value}
            label={f.label}
            selected={statusFilter === f.value}
            onPress={() => setStatusFilter(f.value)}
          />
        ))}
      </XStack>

      {loading && !clients.length ? (
        <YStack flex={1} justifyContent="center" alignItems="center">
          <Spinner size="large" color={BIZLINK_COLORS.brand} />
        </YStack>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingHorizontal: 16 }}
          renderItem={({ item }) => <ClientRow client={item} />}
          refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} />}
          ListEmptyComponent={
            <YStack flex={1} justifyContent="center" alignItems="center" padding="$8">
              <Text color={BIZLINK_COLORS.muted}>
                {clients.length === 0 ? 'No clients yet.' : 'Walang client dito.'}
              </Text>
            </YStack>
          }
        />
      )}
    </YStack>
  );
}
