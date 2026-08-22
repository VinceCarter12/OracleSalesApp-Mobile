import { useEffect, useState } from 'react';
import { ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Calendar, Handshake, Pencil, Repeat, ShieldCheck, Users as UsersIcon } from 'lucide-react-native';
import { Spinner, Text, XStack, YStack } from 'tamagui';
import { BIZLINK_COLORS, BIZLINK_FONTS } from '../../../../lib/theme';
import { CLIENT_STATUS_BADGES } from '../../../../lib/client-status';
import { useTeamOverview } from '../../../../lib/use-team-overview';
import { computeTeamClientProgress } from '../../../../lib/team-remote-mappers';
import { BizTopBar } from '../../../../components/bizlink/BizTopBar';
import { BizCard } from '../../../../components/bizlink/BizCard';
import { BizSectionHeader } from '../../../../components/bizlink/BizSectionHeader';
import { BizButton } from '../../../../components/bizlink/BizButton';
import { ProgressRing } from '../../../../components/ui/ProgressRing';
import { StatusBadge } from '../../../../components/ui/StatusBadge';
import { meetingBadge } from '../../../../lib/meeting-badge';
import { initialsFromName } from '../../../../lib/display-name';
import { useSession } from '../../../../lib/session-store';
import { getClientRecordHolders, type ClientRecordHolder } from '../../../../lib/client-holder-service';
import { GuestHeldClientBanner } from '../../../../components/manager/GuestHeldClientBanner';

const CHECKLIST_LABELS: Record<string, string> = {
  name: 'Company name',
  contact: 'Contact person + position',
  number: 'Contact number',
  address: 'Office address',
  channel: 'Sales channel',
};

/**
 * Wireframe s-detail — progress ring, checklist, meeting history, reassign.
 * Real data (B-054 Phase 1). The "Client info protection" passcode gate
 * (ADR-007) stays removed for Manager per 2026-07-17 feedback. No pending-
 * approval banner — Approvals is fully retired (F-205), not just unwired.
 */
export default function ManagerClientDetailScreen() {
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { overview, loading, error, reload } = useTeamOverview();
  const { profileId } = useSession();

  // ADR-067: read-only display of the client's current permanent record
  // holder set. Fetched independently of `useTeamOverview()` (which has no
  // holder data) — a client-scoped read, so it re-runs whenever the route's
  // `id` param changes, same as any other per-client detail fetch on this
  // screen. Errors are swallowed to a null-holders empty state rather than
  // blocking the whole screen — this is a supplementary display, not the
  // record itself.
  const [holders, setHolders] = useState<ClientRecordHolder[] | null>(null);
  const [holdersLoading, setHoldersLoading] = useState(true);
  const [holdersError, setHoldersError] = useState<string | null>(null);

  useEffect(() => {
    if (typeof id !== 'string') return;
    let cancelled = false;
    setHoldersLoading(true);
    setHoldersError(null);
    getClientRecordHolders(id)
      .then((rows) => {
        if (!cancelled) setHolders(rows);
      })
      .catch((err) => {
        if (!cancelled) setHoldersError(err instanceof Error ? err.message : 'Could not load record holders.');
      })
      .finally(() => {
        if (!cancelled) setHoldersLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (loading) {
    return (
      <YStack flex={1} justifyContent="center" alignItems="center" backgroundColor={BIZLINK_COLORS.canvas}>
        <Spinner size="large" color={BIZLINK_COLORS.brand} />
      </YStack>
    );
  }

  if (error) {
    return (
      <YStack flex={1} justifyContent="center" alignItems="center" backgroundColor={BIZLINK_COLORS.canvas} gap="$3" paddingHorizontal="$5">
        <Text fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted} textAlign="center">{error}</Text>
        <BizButton small label="Ulitin" variant="white" onPress={reload} />
      </YStack>
    );
  }

  // Guest Records fallback (2026-08-22): a held client from another team is
  // never in `overview.clients` (team-scoped) — same class of bug B-131
  // fixed for Meeting Detail, same fix pattern: fall back to
  // `overview.guestClients` before declaring "not found".
  const client = overview?.clients.find((c) => c.id === id) ?? overview?.guestClients.find((c) => c.id === id);
  if (!client) {
    return (
      <YStack flex={1} justifyContent="center" alignItems="center" backgroundColor={BIZLINK_COLORS.canvas}>
        <Text fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted}>Client not found.</Text>
      </YStack>
    );
  }

  const isGuestHeldClient = client.isGuestRecord === true;
  // B-133 follow-up: a guest-held client's owning agent is never in
  // `overview.agents` (own team roster only, by design) — same fallback
  // pattern as B-131's Meeting Detail fix, using the name that travels on
  // the client row itself.
  const agent = overview?.agents.find((a) => a.id === client.agentId)
    ?? (isGuestHeldClient && client.guestOwnerAgentName
      ? { id: client.agentId, name: client.guestOwnerAgentName, initials: initialsFromName(client.guestOwnerAgentName) }
      : undefined);
  // A held client's meetings never live in `overview.meetings` (team-scoped)
  // — `overview.guestMeetings` carries its full history (ADR-067 decision 2).
  const clientMeetings = [...(overview?.meetings ?? []), ...(overview?.guestMeetings ?? [])].filter((m) => m.clientId === client.id);
  const presented = clientMeetings.some((m) => m.agenda.includes('Product / company presentation'));
  const progress = computeTeamClientProgress(client, clientMeetings);
  const isManagerOwned = client.agentId === profileId;
  const lifecycleStages = ['prospect', 'in_progress', 'new', 'existing'] as const;
  const lifecycleIndex = Math.max(0, lifecycleStages.indexOf(client.status as (typeof lifecycleStages)[number]));

  return (
    <YStack flex={1} backgroundColor={BIZLINK_COLORS.canvas} paddingTop={insets.top}>
      <BizTopBar title="Client" fallbackHref="/(manager)/more/clients" />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}>
        <BizCard flexDirection="row" alignItems="flex-start" gap="$3.5">
          <ProgressRing percent={progress} />
          <YStack flex={1} gap="$1.5">
            <Text fontFamily={BIZLINK_FONTS.semibold} fontSize={17} color={BIZLINK_COLORS.text} lineHeight={20}>{client.name}</Text>
            <XStack gap="$1.5">
              <StatusBadge {...CLIENT_STATUS_BADGES[client.status]} />
              {client.channel !== '—' ? (
                <StatusBadge label={client.channel} background={BIZLINK_COLORS.soft} color={BIZLINK_COLORS.muted} />
              ) : null}
            </XStack>
            <Text fontSize={12.5} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted}>
              Agent: <Text color={BIZLINK_COLORS.text} fontFamily={BIZLINK_FONTS.semibold}>{agent?.name ?? 'Unassigned'}</Text>
            </Text>
            {/* States plainly that the ring is a Record Meeting -> Agenda
                outcome, not an info-completion score (B-001, corrected
                2026-07-11 — info completion has zero weight here). */}
            <StatusBadge
              label={presented ? 'Product presentation done (Record Meeting)' : 'No product presentation yet — 0%'}
              background={presented ? BIZLINK_COLORS.tintA : BIZLINK_COLORS.soft}
              color={presented ? BIZLINK_COLORS.brand : BIZLINK_COLORS.muted}
            />
          </YStack>
        </BizCard>

        <GuestHeldClientBanner client={client} />

        <XStack gap="$1" marginTop="$3" paddingHorizontal="$1">
          {lifecycleStages.map((stage, index) => (
            <YStack key={stage} flex={1} gap="$1">
              <YStack height={4} borderRadius={2} backgroundColor={index <= lifecycleIndex ? BIZLINK_COLORS.brand : BIZLINK_COLORS.line} />
              <Text fontSize={9.5} fontFamily={BIZLINK_FONTS.medium} color={index === lifecycleIndex ? BIZLINK_COLORS.brand : BIZLINK_COLORS.muted} textAlign="center">
                {stage === 'in_progress' ? 'In Progress' : stage.charAt(0).toUpperCase() + stage.slice(1)}
              </Text>
            </YStack>
          ))}
        </XStack>

        <BizSectionHeader title="Info completion" helper={client.status === 'prospect' ? `· deadline: ${client.deadline}` : undefined} />
        <Text fontSize={12} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted} marginTop={-6} marginBottom="$2">
          This only tracks the 1-month deadline for completing the client's information. It's separate from
          the progress percentage shown above.
        </Text>
        <BizCard>
          {(Object.keys(CHECKLIST_LABELS) as (keyof typeof CHECKLIST_LABELS)[]).map((key, index, arr) => {
            const done = client.checklist[key as keyof typeof client.checklist];
            return (
              <XStack
                key={key}
                alignItems="center"
                gap="$2.5"
                paddingVertical={9}
                borderBottomWidth={index === arr.length - 1 ? 0 : 1}
                borderBottomColor={BIZLINK_COLORS.line}
              >
                <YStack width={22} height={22} borderRadius={11} backgroundColor={done ? BIZLINK_COLORS.brand : BIZLINK_COLORS.soft} alignItems="center" justifyContent="center">
                  {done ? <Text fontSize={11} fontFamily={BIZLINK_FONTS.semibold} color={BIZLINK_COLORS.card}>✓</Text> : null}
                </YStack>
                <Text fontSize={13.5} fontFamily={BIZLINK_FONTS.medium} color={done ? BIZLINK_COLORS.text : BIZLINK_COLORS.muted}>{CHECKLIST_LABELS[key]}</Text>
              </XStack>
            );
          })}
        </BizCard>

        <YStack alignItems="center" paddingHorizontal="$4" paddingTop="$3">
          <Text fontSize={12} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted} textAlign="center">
            {isManagerOwned
              ? "Manager-owned record: changes apply directly, but they're still version-checked on upload."
              : isGuestHeldClient
                ? "This is a held record from another team — any edit request on it can go through you, and you can reassign it onto your own team."
                : "This is a team record. Sales edit requests go through Approvals; it won't be silently overwritten."}
          </Text>
        </YStack>

        <XStack gap="$2" marginTop="$3">
          {isManagerOwned ? (
            <YStack flex={1}>
              <BizButton
                label="Edit info"
                variant="white"
                icon={<Pencil size={16} color={BIZLINK_COLORS.text} strokeWidth={1.75} />}
                onPress={() => router.push(`/(manager)/clients/complete?clientId=${encodeURIComponent(client.id)}`)}
              />
            </YStack>
          ) : null}
          {/* B-134 (2026-08-22, reversed same day): a holder CAN reassign a
              held client — Web migration 125 widens reassign_team_client()
              with a holder OR-arm, scoped to the caller's own team as the
              only valid destination. Button shown for both own-team and
              guest-held clients now; reassign.tsx's own info banner
              explains the "moves onto your own team" framing for the
              guest-held case. */}
          <YStack flex={1}>
            <BizButton
              label="Reassign client"
              variant="navy"
              icon={<Repeat size={17} color="#FFFFFF" strokeWidth={1.75} />}
              onPress={() => router.push(`/(manager)/more/clients/reassign?clientId=${encodeURIComponent(client.id)}`)}
            />
          </YStack>
        </XStack>

        <BizSectionHeader title="Record holders" helper="Permanent once approved" />
        {holdersLoading ? (
          <YStack alignItems="center" paddingVertical="$3">
            <Spinner size="small" color={BIZLINK_COLORS.brand} />
          </YStack>
        ) : holdersError ? (
          <Text fontSize={12} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted}>{holdersError}</Text>
        ) : !holders || holders.length === 0 ? (
          <Text fontSize={12} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted}>
            No manager has become a record holder for this client yet.
          </Text>
        ) : (
          <BizCard gap="$0">
            {holders.map((holder, index) => (
              <XStack
                key={holder.managerId}
                alignItems="center"
                gap="$2.5"
                paddingVertical={9}
                borderBottomWidth={index === holders.length - 1 ? 0 : 1}
                borderBottomColor={BIZLINK_COLORS.line}
              >
                <YStack width={30} height={30} borderRadius={15} alignItems="center" justifyContent="center" backgroundColor={BIZLINK_COLORS.tintA}>
                  <ShieldCheck size={14} color={BIZLINK_COLORS.brand} strokeWidth={1.75} />
                </YStack>
                <Text fontSize={13.5} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.text}>
                  {holder.managerName ?? 'Manager'}
                </Text>
              </XStack>
            ))}
          </BizCard>
        )}

        <BizSectionHeader title="Meeting history" />
        {clientMeetings.length === 0 ? (
          <YStack alignItems="center" paddingVertical="$5" gap="$2">
            <Handshake size={26} color={BIZLINK_COLORS.muted} strokeWidth={1.75} />
            <Text fontSize={13} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted}>No meeting has been recorded yet.</Text>
          </YStack>
        ) : (
          clientMeetings.map((m) => (
            <XStack
              key={m.id}
              alignItems="center"
              gap="$3"
              backgroundColor={BIZLINK_COLORS.card}
              borderRadius={20}
              padding={14}
              marginBottom={10}
              onPress={() => router.push(`/(manager)/more/meetings/${m.id}`)}
            >
              <YStack width={36} height={36} borderRadius={18} alignItems="center" justifyContent="center" backgroundColor={BIZLINK_COLORS.soft}>
                <Calendar size={15} color={BIZLINK_COLORS.muted} strokeWidth={1.75} />
              </YStack>
              <YStack flex={1}>
                <Text fontFamily={BIZLINK_FONTS.semibold} fontSize={14} color={BIZLINK_COLORS.text}>{m.date} · {m.time}</Text>
                <XStack alignItems="center" gap="$1.5">
                  <Text fontSize={11.5} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted}>{m.location}</Text>
                  {m.tagAlong ? (
                    <XStack alignItems="center" gap="$0.5">
                      <UsersIcon size={10} color={BIZLINK_COLORS.navy} strokeWidth={1.75} />
                      <Text fontSize={10.5} fontFamily={BIZLINK_FONTS.semibold} color={BIZLINK_COLORS.navy}>companion</Text>
                    </XStack>
                  ) : null}
                </XStack>
              </YStack>
              {meetingBadge(m)}
              {!m.synced ? <Text fontSize={11} fontFamily={BIZLINK_FONTS.semibold} color={BIZLINK_COLORS.navy}>↻ pending</Text> : null}
            </XStack>
          ))
        )}
      </ScrollView>
    </YStack>
  );
}
