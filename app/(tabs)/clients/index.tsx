import { useCallback, useMemo, useState } from 'react';
import { FlatList, Pressable, RefreshControl, ScrollView, TextInput } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { Building2, Calendar, Plus } from 'lucide-react-native';
import { Spinner, Text, XStack, YStack } from 'tamagui';
import { useBizlinkColors, BIZLINK_FONTS, BIZLINK_ON_INK } from '../../../lib/theme';
import { useClients } from '../../../lib/useClients';
import { useMeetings } from '../../../lib/useMeetings';
import { CLIENT_STATUS_BADGES, getClientStatus } from '../../../lib/client-status';
import { getClientDeadlineInfo } from '../../../lib/client-deadline';
import { getClientProgress } from '../../../lib/client-progress';
import { StatusBadge } from '../../../components/ui/StatusBadge';
import { SyncBadge } from '../../../components/sync/SyncBadge';
import { BizCard } from '../../../components/bizlink/BizCard';
import { BizChip } from '../../../components/bizlink/BizChip';
import type { OutboxStatus } from '../../../lib/sync/outbox-status';
import type { Client, ClientStatus, Meeting } from '../../../types';

// Wireframe #a-clients' filter row is exactly All/Prospect/New/Existing — no
// "Inactive" chip (that status is server-side lifecycle only, never agent-
// facing, per types/index.ts's CLIENT_STATUSES comment).
type StatusFilter = ClientStatus | 'all';
const STATUS_FILTERS: Array<{ value: StatusFilter; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'prospect', label: 'Prospect' },
  { value: 'new', label: 'New' },
  { value: 'existing', label: 'Existing' },
];

/** Wireframe #a-clients' static "Jul 2026"-style month chip — decorative, mirrors meetings/index.tsx's. */
function currentMonthLabel(): string {
  return new Date().toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

/**
 * Wireframe #a-clients' exact card anatomy (`aRenderClientsFiltered`): tt →
 * td → metarow (deadline-or-channel micro-label + status pill + sync pill)
 * → progress bar (prospect only). Non-prospect rows deliberately show the
 * channel TWICE — once in `.td`, once again as the metarow's micro-label —
 * this looks redundant but matches the wireframe byte-for-byte.
 */
function ClientRow({ client, meetings }: { client: Client; meetings: Meeting[] }) {
  const BIZLINK_COLORS = useBizlinkColors();
  const status = getClientStatus(client);
  const badge = CLIENT_STATUS_BADGES[status];
  const isProspect = status === 'prospect';
  const deadline = isProspect ? getClientDeadlineInfo(client) : null;
  const progress = isProspect ? getClientProgress(client, meetings) : null;
  const metaLabel = isProspect ? deadline?.label : client.sales_channel || null;

  return (
    <Pressable onPress={() => router.push(`/(tabs)/clients/${client.id}`)}>
      <BizCard gap="$1.5" paddingVertical={16} paddingHorizontal={18} marginBottom={10}>
        <Text fontFamily={BIZLINK_FONTS.semibold} fontSize={15} letterSpacing={-0.2} color={BIZLINK_COLORS.text}>{client.company_name}</Text>
        <Text fontSize={12} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted}>
          {client.sales_channel || 'Walang detalye pa — kumpletuhin ang info'}
        </Text>

        <XStack alignItems="center" gap="$2" marginTop="$1.5">
          {metaLabel ? (
            <Text fontSize={11} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted}>
              {isProspect ? 'Deadline ' : ''}
              <Text fontFamily={BIZLINK_FONTS.semibold} color={isProspect && deadline?.warn ? BIZLINK_COLORS.red : BIZLINK_COLORS.text}>
                {metaLabel}
              </Text>
            </Text>
          ) : null}
          <StatusBadge {...badge} />
          {client.sync_status ? <SyncBadge status={client.sync_status as OutboxStatus} /> : null}
          <Text color={BIZLINK_COLORS.muted} fontSize={16} marginLeft="auto">›</Text>
        </XStack>

        {progress !== null ? (
          <XStack alignItems="center" gap="$2.5" marginTop="$1.5">
            <Text fontSize={11} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted}>Progress</Text>
            <YStack flex={1} height={6} borderRadius={999} backgroundColor={BIZLINK_COLORS.soft} overflow="hidden">
              <YStack height={6} borderRadius={999} backgroundColor={BIZLINK_COLORS.brand} width={`${progress}%`} />
            </YStack>
            <Text fontSize={12} fontFamily={BIZLINK_FONTS.semibold} color={BIZLINK_COLORS.text}>{progress}%</Text>
          </XStack>
        ) : null}
      </BizCard>
    </Pressable>
  );
}

export default function ClientsScreen() {
  const BIZLINK_COLORS = useBizlinkColors();
  const insets = useSafeAreaInsets();
  const { clients, loading, refresh } = useClients();
  const { meetings } = useMeetings();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<StatusFilter>('all');

  // Refreshes on every return to this screen — e.g. right after Create
  // Client saves locally (client-service.ts), so the new row shows up
  // without needing a manual pull-to-refresh.
  useFocusEffect(useCallback(() => { refresh(); }, [refresh]));

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return clients.filter((c) => {
      if (filter !== 'all' && getClientStatus(c) !== filter) return false;
      if (query && !c.company_name.toLowerCase().includes(query)) return false;
      return true;
    });
  }, [clients, search, filter]);

  return (
    <YStack flex={1} backgroundColor={BIZLINK_COLORS.canvas} paddingTop={insets.top}>
      <XStack alignItems="center" paddingHorizontal="$4" paddingTop="$2.5" paddingBottom="$1.5">
        <Text fontSize={26} fontFamily={BIZLINK_FONTS.semibold} color={BIZLINK_COLORS.text}>My Clients</Text>
        <XStack marginLeft="auto" gap="$2" alignItems="center">
          <Pressable
            onPress={() => router.push('/(tabs)/clients/create')}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 6,
              backgroundColor: BIZLINK_COLORS.brand,
              borderRadius: 999,
              paddingHorizontal: 16,
              paddingVertical: 10,
              minHeight: 44,
            }}
          >
            <Plus size={14} color={BIZLINK_ON_INK.solid} strokeWidth={1.75} />
            <Text fontSize={12.5} fontFamily={BIZLINK_FONTS.semibold} color={BIZLINK_ON_INK.solid}>Create a Client</Text>
          </Pressable>
        </XStack>
      </XStack>

      <XStack paddingHorizontal="$4" justifyContent="flex-start">
        <XStack
          alignItems="center"
          gap="$1.5"
          backgroundColor={BIZLINK_COLORS.card}
          borderRadius={999}
          paddingHorizontal={13}
          paddingVertical={7}
        >
          <Calendar size={12} color={BIZLINK_COLORS.muted} strokeWidth={1.75} />
          <Text fontSize={11.5} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted}>
            {currentMonthLabel()}
          </Text>
        </XStack>
      </XStack>

      <YStack paddingHorizontal="$4" gap="$2.5" marginTop="$2">
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search company name…"
          placeholderTextColor={BIZLINK_COLORS.muted}
          style={{
            height: 52,
            borderRadius: 16,
            paddingHorizontal: 16,
            fontFamily: BIZLINK_FONTS.medium,
            fontSize: 14.5,
            color: BIZLINK_COLORS.text,
            backgroundColor: BIZLINK_COLORS.card,
            borderWidth: 1,
            borderColor: BIZLINK_COLORS.line,
          }}
        />
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <XStack gap="$2">
            {STATUS_FILTERS.map((f) => (
              <BizChip
                key={f.value}
                label={f.label}
                selected={filter === f.value}
                onPress={() => setFilter(f.value)}
              />
            ))}
          </XStack>
        </ScrollView>
      </YStack>

      {loading && !clients.length ? (
        <YStack flex={1} justifyContent="center" alignItems="center">
          <Spinner size="large" color={BIZLINK_COLORS.brand} />
        </YStack>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 16, paddingTop: 20 }}
          renderItem={({ item }) => <ClientRow client={item} meetings={meetings} />}
          refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} />}
          ListEmptyComponent={
            <YStack alignItems="center" padding="$8" gap="$2.5">
              <Building2 size={40} color={BIZLINK_COLORS.muted} strokeWidth={1.75} />
              <Text fontSize={13} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted} textAlign="center">
                {clients.length === 0 ? 'Wala ka pang clients.' : 'Walang tumugma sa filter.'}
              </Text>
            </YStack>
          }
        />
      )}
    </YStack>
  );
}
