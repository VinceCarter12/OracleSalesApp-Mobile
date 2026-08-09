import { useMemo, useState } from 'react';
import { ScrollView, TextInput } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Handshake, Inbox, Search } from 'lucide-react-native';
import { Spinner, Text, XStack, YStack } from 'tamagui';
import { BIZLINK_COLORS, BIZLINK_FONTS } from '../../../lib/theme';
import { CLIENT_STATUS_BADGES } from '../../../lib/client-status';
import { useTeamOverview } from '../../../lib/use-team-overview';
import { avatarPaletteFor } from '../../../lib/avatar-palette';
import { BizTopBar } from '../../../components/bizlink/BizTopBar';
import { BizSectionHeader } from '../../../components/bizlink/BizSectionHeader';
import { BizButton } from '../../../components/bizlink/BizButton';
import { BizFilterScroll } from '../../../components/bizlink/BizFilterScroll';
import { BizFloatingPager } from '../../../components/bizlink/BizFloatingPager';
import { Avatar } from '../../../components/ui/Avatar';
import { StatusBadge } from '../../../components/ui/StatusBadge';
import { meetingBadge } from '../../../lib/meeting-badge';
import { PAGINATION_PAGE_SIZE, usePagination } from '../../../lib/use-pagination';
import type { ClientStatus, ManagerOutcome, TeamClient, TeamMeeting } from '../../../types';

type StatusFilter = ClientStatus | 'all';
type HistoryFilter = ManagerOutcome | 'all';
type AgentDetailView = 'clients' | 'history';

const DETAIL_VIEW_OPTIONS: { value: AgentDetailView; label: string }[] = [
  { value: 'clients', label: 'Clients' },
  { value: 'history', label: 'History' },
];

// Same lifecycle order as the Sales/RSR My Clients list. Inactive remains a
// server-side lifecycle state and is intentionally not an agent-facing chip.
const CLIENT_STATUS_FILTERS: { value: StatusFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'prospect', label: 'Prospect' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'new', label: 'New' },
  { value: 'existing', label: 'Existing' },
];

const HISTORY_FILTERS: { value: HistoryFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'success', label: 'Successful' },
  { value: 'follow', label: 'Follow-up' },
  { value: 'nodec', label: 'No decision' },
  { value: 'lost', label: 'Lost' },
];

/** Wireframe s-agent — one agent's real client or meeting-history view (B-054 Phase 1). */
export default function AgentDetailScreen() {
  const insets = useSafeAreaInsets();
  const { agentId } = useLocalSearchParams<{ agentId: string }>();
  const { overview, loading, error, reload } = useTeamOverview();
  const [view, setView] = useState<AgentDetailView>('clients');
  const [clientSearch, setClientSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [historySearch, setHistorySearch] = useState('');
  const [historyFilter, setHistoryFilter] = useState<HistoryFilter>('all');

  const clients = useMemo(() => overview?.clients.filter((client) => client.agentId === agentId) ?? [], [overview, agentId]);
  const meetings = useMemo(() => overview?.meetings.filter((meeting) => meeting.agentId === agentId) ?? [], [overview, agentId]);
  const clientNamesById = useMemo(() => new Map(clients.map((client) => [client.id, client.name])), [clients]);

  const filteredClients = useMemo(() => {
    const query = clientSearch.trim().toLowerCase();
    return clients.filter((client) => {
      if (statusFilter !== 'all' && client.status !== statusFilter) return false;
      return !query || `${client.name} ${client.channel}`.toLowerCase().includes(query);
    });
  }, [clientSearch, clients, statusFilter]);
  const clientResetKey = `${statusFilter}:${clientSearch.trim().toLowerCase()}`;
  const { page: clientPage, totalPages: clientTotalPages, pageItems: clientPageItems, setPage: setClientPage } = usePagination(filteredClients, clientResetKey);

  const filteredMeetings = useMemo(() => {
    const query = historySearch.trim().toLowerCase();
    return meetings.filter((meeting) => {
      if (historyFilter !== 'all' && meeting.outcome !== historyFilter) return false;
      return !query || `${clientNamesById.get(meeting.clientId) ?? ''} ${meeting.location}`.toLowerCase().includes(query);
    });
  }, [clientNamesById, historyFilter, historySearch, meetings]);
  const historyResetKey = `${historyFilter}:${historySearch.trim().toLowerCase()}`;
  const { page: historyPage, totalPages: historyTotalPages, pageItems: historyPageItems, setPage: setHistoryPage } = usePagination(filteredMeetings, historyResetKey);

  if (loading) {
    return (
      <YStack flex={1} backgroundColor={BIZLINK_COLORS.canvas} paddingTop={insets.top}>
        <BizTopBar title="Agent" fallbackHref="/(manager)/team" />
        <YStack flex={1} justifyContent="center" alignItems="center">
          <Spinner size="large" color={BIZLINK_COLORS.brand} />
        </YStack>
      </YStack>
    );
  }

  if (error) {
    return (
      <YStack flex={1} backgroundColor={BIZLINK_COLORS.canvas} paddingTop={insets.top}>
        <BizTopBar title="Agent" fallbackHref="/(manager)/team" />
        <YStack flex={1} justifyContent="center" alignItems="center" gap="$3" paddingHorizontal="$5">
          <Text fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted} textAlign="center">{error}</Text>
          <BizButton small label="Ulitin" variant="white" onPress={reload} />
        </YStack>
      </YStack>
    );
  }

  const agent = overview?.agents.find((item) => item.id === agentId);
  if (!agent) {
    return (
      <YStack flex={1} backgroundColor={BIZLINK_COLORS.canvas} paddingTop={insets.top}>
        <BizTopBar title="Agent" fallbackHref="/(manager)/team" />
        <YStack flex={1} justifyContent="center" alignItems="center" paddingHorizontal="$5">
          <Text fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted} textAlign="center">Agent not found.</Text>
        </YStack>
      </YStack>
    );
  }

  return (
    <YStack flex={1} backgroundColor={BIZLINK_COLORS.canvas} paddingTop={insets.top}>
      <BizTopBar title={agent.name.split(' ')[0]} fallbackHref="/(manager)/team" />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 120 + insets.bottom }}>
        <XStack alignItems="center" gap="$3.5" backgroundColor={BIZLINK_COLORS.card} borderRadius={24} padding={18}>
          <Avatar initials={agent.initials} size="lg" background={avatarPaletteFor(agent.id).background} color={avatarPaletteFor(agent.id).color} />
          <YStack>
            <Text fontFamily={BIZLINK_FONTS.semibold} fontSize={17} color={BIZLINK_COLORS.text}>{agent.name}</Text>
            <Text fontSize={13} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted}>Sales Specialist · under your team</Text>
          </YStack>
        </XStack>

        <XStack gap={10} marginTop={14}>
          <StatBox value={agent.meetingsThisMonth} label="Meetings" color={BIZLINK_COLORS.text} />
          <StatBox value={agent.activeClients} label="Clients" color={BIZLINK_COLORS.navy} />
          <StatBox value={`${agent.successRate}%`} label="Success rate" color={BIZLINK_COLORS.orange} />
        </XStack>

        <YStack marginTop="$4" marginBottom="$1">
          <BizFilterScroll options={DETAIL_VIEW_OPTIONS} value={view} onChange={setView} />
        </YStack>

        {view === 'clients' ? (
          <>
            <BizSectionHeader title="Clients handled" />
            <SearchField value={clientSearch} onChangeText={setClientSearch} placeholder="Search company or channel…" />
            <YStack marginBottom="$2.5">
              <BizFilterScroll options={CLIENT_STATUS_FILTERS} value={statusFilter} onChange={setStatusFilter} />
            </YStack>
            {clients.length === 0 ? (
              <EmptyRow icon={<Inbox size={22} color={BIZLINK_COLORS.muted} strokeWidth={1.75} />} label="Walang clients na naka-assign." />
            ) : filteredClients.length === 0 ? (
              <EmptyRow icon={<Inbox size={22} color={BIZLINK_COLORS.muted} strokeWidth={1.75} />} label="Walang client na tumugma sa filter." />
            ) : (
              clientPageItems.map((client, index) => (
                <ClientRow key={client.id} client={client} rowNumber={(clientPage - 1) * PAGINATION_PAGE_SIZE + index + 1} />
              ))
            )}
          </>
        ) : (
          <>
            <BizSectionHeader title="Meeting history" />
            <SearchField value={historySearch} onChangeText={setHistorySearch} placeholder="Search company or location…" />
            <YStack marginBottom="$2.5">
              <BizFilterScroll options={HISTORY_FILTERS} value={historyFilter} onChange={setHistoryFilter} />
            </YStack>
            {meetings.length === 0 ? (
              <EmptyRow icon={<Handshake size={22} color={BIZLINK_COLORS.muted} strokeWidth={1.75} />} label="Wala pang meetings." />
            ) : filteredMeetings.length === 0 ? (
              <EmptyRow icon={<Handshake size={22} color={BIZLINK_COLORS.muted} strokeWidth={1.75} />} label="Walang meeting na tumugma sa filter." />
            ) : (
              historyPageItems.map((meeting, index) => (
                <MeetingRow
                  key={meeting.id}
                  meeting={meeting}
                  clientName={clientNamesById.get(meeting.clientId) ?? 'Unknown client'}
                  rowNumber={(historyPage - 1) * PAGINATION_PAGE_SIZE + index + 1}
                />
              ))
            )}
          </>
        )}
      </ScrollView>

      {view === 'clients' && filteredClients.length > 0 ? (
        <BizFloatingPager page={clientPage} totalPages={clientTotalPages} onPageChange={setClientPage} bottomOffset={insets.bottom + 16} />
      ) : view === 'history' && filteredMeetings.length > 0 ? (
        <BizFloatingPager page={historyPage} totalPages={historyTotalPages} onPageChange={setHistoryPage} bottomOffset={insets.bottom + 16} />
      ) : null}
    </YStack>
  );
}

function SearchField({ value, onChangeText, placeholder }: { value: string; onChangeText: (value: string) => void; placeholder: string }) {
  return (
    <XStack alignItems="center" backgroundColor={BIZLINK_COLORS.card} borderWidth={1} borderColor={BIZLINK_COLORS.line} borderRadius={16} height={52} paddingHorizontal={16} gap="$2" marginBottom="$2">
      <Search size={16} color={BIZLINK_COLORS.muted} strokeWidth={1.75} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={BIZLINK_COLORS.muted}
        style={{ flex: 1, fontFamily: BIZLINK_FONTS.medium, fontSize: 14.5, color: BIZLINK_COLORS.text }}
      />
    </XStack>
  );
}

function RowNumber({ value }: { value: number }) {
  return (
    <YStack width={26} height={26} borderRadius={13} backgroundColor={BIZLINK_COLORS.tintA} alignItems="center" justifyContent="center" flexShrink={0}>
      <Text fontSize={11} fontFamily={BIZLINK_FONTS.semibold} color={BIZLINK_COLORS.ink}>{value}</Text>
    </YStack>
  );
}

function ClientRow({ client, rowNumber }: { client: TeamClient; rowNumber: number }) {
  return (
    <XStack alignItems="center" gap="$3" backgroundColor={BIZLINK_COLORS.card} borderRadius={20} padding={14} marginBottom={10} onPress={() => router.push(`/(manager)/more/clients/${client.id}`)}>
      <RowNumber value={rowNumber} />
      <Avatar initials={client.name.slice(0, 2).toUpperCase()} size="sm" background={BIZLINK_COLORS.soft} color={BIZLINK_COLORS.muted} />
      <YStack flex={1}>
        <Text fontFamily={BIZLINK_FONTS.semibold} fontSize={14} color={BIZLINK_COLORS.text}>{client.name}</Text>
        <Text fontSize={11.5} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted}>{client.channel}</Text>
      </YStack>
      <StatusBadge {...CLIENT_STATUS_BADGES[client.status]} />
      <Text color={BIZLINK_COLORS.muted} fontSize={16}>›</Text>
    </XStack>
  );
}

function MeetingRow({ meeting, clientName, rowNumber }: { meeting: TeamMeeting; clientName: string; rowNumber: number }) {
  return (
    <XStack alignItems="center" gap="$3" backgroundColor={BIZLINK_COLORS.card} borderRadius={20} padding={14} marginBottom={10} onPress={() => router.push(`/(manager)/more/meetings/${meeting.id}`)}>
      <RowNumber value={rowNumber} />
      <YStack width={36} height={36} borderRadius={18} alignItems="center" justifyContent="center" backgroundColor={BIZLINK_COLORS.soft}>
        <Handshake size={15} color={BIZLINK_COLORS.muted} strokeWidth={1.75} />
      </YStack>
      <YStack flex={1}>
        <Text fontFamily={BIZLINK_FONTS.semibold} fontSize={14} color={BIZLINK_COLORS.text}>{clientName}</Text>
        <Text fontSize={11.5} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted}>{meeting.date} · {meeting.time}</Text>
      </YStack>
      {meetingBadge(meeting)}
      <Text color={BIZLINK_COLORS.muted} fontSize={16}>›</Text>
    </XStack>
  );
}

function StatBox({ value, label, color }: { value: number | string; label: string; color: string }) {
  return (
    <YStack flex={1} backgroundColor={BIZLINK_COLORS.card} borderRadius={20} padding={14}>
      <Text fontSize={24} fontFamily={BIZLINK_FONTS.semibold} color={color}>{value}</Text>
      <Text fontSize={11.5} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted}>{label}</Text>
    </YStack>
  );
}

function EmptyRow({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <YStack alignItems="center" paddingVertical="$5" gap="$2">
      {icon}
      <Text fontSize={13} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted} textAlign="center">{label}</Text>
    </YStack>
  );
}
