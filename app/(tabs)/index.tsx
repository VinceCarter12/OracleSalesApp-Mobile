import { useCallback, useState } from 'react';
import { Pressable, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import {
  Bell,
  Building2,
  Camera,
  ClipboardList,
  Handshake,
  Hourglass,
  Magnet,
  Plus,
  RefreshCw,
  Target,
  Users,
} from 'lucide-react-native';
import { Text, View, XStack, YStack } from 'tamagui';
import { COLORS } from '../../lib/theme';
import { useClients } from '../../lib/useClients';
import { useMeetings } from '../../lib/useMeetings';
import { getOutboxCounts, type OutboxCounts } from '../../lib/sync-engine';
import { getClientStatus, CLIENT_STATUS_BADGES } from '../../lib/client-status';
import { StatCard } from '../../components/manager/StatCard';
import { Avatar } from '../../components/ui/Avatar';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { SectionHeader } from '../../components/ui/SectionHeader';
import { QuickAction } from '../../components/home/QuickAction';
import { useSession } from '../../lib/session-store';
import { RSR_DAILY_VISIT_QUOTA, type Client, type Meeting } from '../../types';

// F-012 (RSR only): today's in-person visits vs the daily quota. Online
// meetings never count (ADR-012); fast-path visits do (they are in-person by
// definition, ADR-015).
function countTodayInPersonVisits(meetings: Meeting[]): number {
  const today = new Date();
  return meetings.filter((m) => {
    if (m.meeting_mode === 'online') return false;
    const d = new Date(m.logged_at);
    return (
      d.getDate() === today.getDate() &&
      d.getMonth() === today.getMonth() &&
      d.getFullYear() === today.getFullYear()
    );
  }).length;
}

function RsrQuotaWidget({ meetings }: { meetings: Meeting[] }) {
  const visits = countTodayInPersonVisits(meetings);
  const pct = Math.min(100, Math.round((visits / RSR_DAILY_VISIT_QUOTA) * 100));
  return (
    <YStack
      backgroundColor={COLORS.snow}
      borderWidth={2}
      borderColor={COLORS.swan}
      borderRadius={16}
      padding={14}
      marginTop={10}
    >
      <XStack justifyContent="space-between" alignItems="center" marginBottom={8}>
        <XStack alignItems="center" gap="$1.5">
          <Target size={14} color={COLORS.eel} />
          <Text fontSize={12.5} fontWeight="800" color={COLORS.eel}>Daily visit quota (RSR)</Text>
        </XStack>
        <Text fontSize={12} fontWeight="800" color={COLORS.hare}>
          {visits} / {RSR_DAILY_VISIT_QUOTA}
        </Text>
      </XStack>
      <View height={8} borderRadius={99} backgroundColor={COLORS.polar} overflow="hidden">
        <View height="100%" borderRadius={99} backgroundColor={COLORS.feather} width={`${pct}%`} />
      </View>
      <Text fontSize={11} fontWeight="600" color={COLORS.hare} marginTop={8}>
        Minimum {RSR_DAILY_VISIT_QUOTA} clients/day — binibilang ang in-person visits na naitala ngayong araw.
      </Text>
    </YStack>
  );
}

function ClientPreviewRow({ client }: { client: Client }) {
  const badge = CLIENT_STATUS_BADGES[getClientStatus(client)];
  return (
    <Pressable onPress={() => router.push(`/(tabs)/clients/${client.id}`)}>
      <XStack
        alignItems="center"
        gap="$3"
        paddingVertical={13}
        borderBottomWidth={2}
        borderBottomColor={COLORS.polar}
      >
        <YStack flex={1} gap="$0.5">
          <Text fontWeight="800" fontSize={14} color={COLORS.eel}>{client.company_name}</Text>
          <Text fontSize={11.5} fontWeight="600" color={COLORS.hare}>
            {client.contact_person || 'Walang contact person pa'}
          </Text>
        </YStack>
        <StatusBadge {...badge} />
        <Text color={COLORS.swanLedge} fontSize={16}>›</Text>
      </XStack>
    </Pressable>
  );
}

export default function AgentHomeScreen() {
  const insets = useSafeAreaInsets();
  const { clients } = useClients();
  const { meetings } = useMeetings();
  const { role } = useSession();
  const isRsr = role === 'rsr';

  // T-007: real outbox counts (getOutboxCounts already exists — built as
  // part of T-002's sync engine, just never surfaced in the UI). Read-only
  // fetch here rather than calling useSync() again (already mounted once at
  // the root, app/_layout.tsx) — that hook also owns a live NetInfo listener
  // that triggers an actual sync on reconnect, and mounting a second one
  // would double that side effect for no benefit.
  const [outboxCounts, setOutboxCounts] = useState<OutboxCounts>({
    pending: 0,
    syncing: 0,
    conflict: 0,
    failed: 0,
    synced: 0,
  });
  useFocusEffect(
    useCallback(() => {
      getOutboxCounts().then(setOutboxCounts).catch(() => {});
    }, [])
  );
  const pendingSyncCount = outboxCounts.pending + outboxCounts.failed + outboxCounts.conflict;

  const prospects = clients.filter((c) => getClientStatus(c) === 'prospect');
  const nonProspects = clients.filter((c) => getClientStatus(c) !== 'prospect');
  const now = new Date();
  const thisMonth = meetings.filter((m) => {
    const d = new Date(m.logged_at);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });
  const successful = thisMonth.filter((m) => m.outcome === 'Successful');

  return (
    <YStack flex={1} backgroundColor={COLORS.snow} paddingTop={insets.top}>
      <XStack alignItems="center" gap="$3" paddingHorizontal="$4" paddingTop="$2.5" paddingBottom="$1.5">
        <Avatar initials="MS" />
        <YStack gap="$1">
          <Text fontWeight="800" fontSize={15.5} color={COLORS.eel}>Kamusta, Miguel!</Text>
          <StatusBadge label={isRsr ? 'RSR' : 'Sales Specialist'} background={COLORS.greenTint} color={COLORS.ledgeGreen} />
        </YStack>
        <Pressable onPress={() => router.push('/(tabs)/more')} style={{ marginLeft: 'auto' }}>
          <View
            width={40}
            height={40}
            borderRadius={20}
            backgroundColor={COLORS.polar}
            alignItems="center"
            justifyContent="center"
          >
            <Bell size={17} color={COLORS.eel} />
          </View>
        </Pressable>
      </XStack>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 96 }}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingVertical: 8 }}>
          <StatCard
            icon={<Magnet size={15} color={COLORS.blue} />}
            iconBackground={COLORS.blueSoft}
            value={prospects.length}
            label="Prospects ko"
            delta="lifecycle: 1-month info rule"
            onPress={() => router.push('/(tabs)/clients')}
          />
          <StatCard
            icon={<Building2 size={15} color={COLORS.ledgeGreen} />}
            iconBackground={COLORS.greenTint}
            value={nonProspects.length}
            label="Clients ko"
            delta="new + existing"
            onPress={() => router.push('/(tabs)/clients')}
          />
          <StatCard
            icon={<Handshake size={15} color={COLORS.orange} />}
            iconBackground={COLORS.amberSoft}
            value={thisMonth.length}
            label="Meetings this mo."
            delta={`${successful.length} successful`}
            onPress={() => router.push('/(tabs)/meetings')}
          />
        </ScrollView>

        {isRsr ? <RsrQuotaWidget meetings={meetings} /> : null}

        {/* T-007: real outbox counts, no longer a static placeholder. */}
        <XStack
          alignItems="center"
          gap="$2.5"
          backgroundColor={outboxCounts.failed || outboxCounts.conflict ? COLORS.redSoft : COLORS.blueSoft}
          borderWidth={2}
          borderColor={outboxCounts.failed || outboxCounts.conflict ? COLORS.ledgeRed : COLORS.blueBorder}
          borderRadius={14}
          paddingHorizontal={14}
          paddingVertical={11}
          marginTop={12}
        >
          <RefreshCw size={16} color={outboxCounts.failed || outboxCounts.conflict ? COLORS.ledgeRed : COLORS.blue} />
          <YStack>
            <Text fontSize={12.5} fontWeight="800" color={outboxCounts.failed || outboxCounts.conflict ? COLORS.ledgeRed : COLORS.blue}>
              {pendingSyncCount === 0 ? 'Naka-sync na lahat' : `${pendingSyncCount} record${pendingSyncCount > 1 ? 's' : ''} pending sync`}
            </Text>
            <Text fontSize={11} fontWeight="600" color="#3B5878">
              {outboxCounts.failed > 0
                ? `${outboxCounts.failed} failed — kailangan i-retry`
                : outboxCounts.conflict > 0
                  ? `${outboxCounts.conflict} may conflict`
                  : 'Auto-uploads kapag may signal'}
            </Text>
          </YStack>
        </XStack>

        {prospects.length > 0 ? (
          <XStack
            alignItems="center"
            gap="$2.5"
            backgroundColor={COLORS.amberSoft}
            borderWidth={2}
            borderColor="#D9B168"
            borderRadius={14}
            paddingHorizontal={14}
            paddingVertical={11}
            marginTop={10}
          >
            <Hourglass size={18} color={COLORS.orange} />
            <YStack flex={1}>
              <Text fontSize={12.5} fontWeight="800" color={COLORS.orange}>
                {prospects.length} prospect{prospects.length > 1 ? 's' : ''} na kailangan kumpletuhin
              </Text>
              <Text fontSize={11} fontWeight="600" color="#8C6A2E">1-month rule — kumpletuhin o auto-delete</Text>
            </YStack>
          </XStack>
        ) : null}

        <SectionHeader
          title="Mga Client Ko"
          actionLabel="Tingnan lahat"
          onAction={() => router.push('/(tabs)/clients')}
        />
        {clients.slice(0, 3).map((client) => (
          <ClientPreviewRow key={client.id} client={client} />
        ))}
        {clients.length === 0 ? (
          <Text fontSize={13} fontWeight="600" color={COLORS.hare} paddingVertical="$3">
            Wala ka pang clients — magsimula sa Create Client.
          </Text>
        ) : null}

        <SectionHeader title="Quick Actions" />
        <XStack gap="$2.5" flexWrap="wrap">
          <QuickAction icon={<Plus size={16} color={COLORS.ledgeGreen} />} label="Create Client" onPress={() => router.push('/(tabs)/clients/create')} />
          <QuickAction icon={<Camera size={16} color={COLORS.ledgeGreen} />} label="Record Meeting" onPress={() => router.push('/(tabs)/meetings/select-client')} />
          <QuickAction icon={<ClipboardList size={16} color={COLORS.ledgeGreen} />} label="My Clients" onPress={() => router.push('/(tabs)/clients')} />
          <QuickAction icon={<Users size={16} color={COLORS.ledgeGreen} />} label="Tag-Along" onPress={() => router.push('/(tabs)/more/tag-along')} />
        </XStack>
      </ScrollView>
    </YStack>
  );
}
