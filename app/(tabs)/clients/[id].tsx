import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { Camera, Check, Pencil } from 'lucide-react-native';
import { Spinner, Text, View, XStack, YStack } from 'tamagui';
import { getClientById } from '../../../lib/client-service';
import { useSession } from '../../../lib/session-store';
import {
  getClientCompanionRequests,
  getClientIdsWithPendingManagerTagAlong,
  companionRequestDisplayStatus,
  COMPANION_REQUEST_STATUS_LABELS,
  COMPANION_REQUEST_BADGE_TONES,
  type ClientCompanionRequest,
} from '../../../lib/tag-along-service';
import { OUTCOME_BADGE_STYLES, BIZLINK_COLORS, BIZLINK_FONTS } from '../../../lib/theme';
import { CLIENT_STATUS_BADGES, getClientStatus, WAITING_MANAGER_APPROVAL_BADGE } from '../../../lib/client-status';
import { getClientProgressBreakdown, getInfoChecklist } from '../../../lib/client-progress';
import { useMeetings } from '../../../lib/useMeetings';
import { useClientFlowRoutes } from '../../../lib/use-role-routes';
import { BizTopBar } from '../../../components/bizlink/BizTopBar';
import { BizLockButton } from '../../../components/bizlink/BizLockButton';
import { BizCard } from '../../../components/bizlink/BizCard';
import { BizSectionHeader } from '../../../components/bizlink/BizSectionHeader';
import { BizButton } from '../../../components/bizlink/BizButton';
import { ProgressRing } from '../../../components/ui/ProgressRing';
import { StatusBadge } from '../../../components/ui/StatusBadge';
import type { Client } from '../../../types';

export default function ClientDetailScreen() {
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { profileId } = useSession();
  const routes = useClientFlowRoutes();
  const [client, setClient] = useState<Client | null>(null);
  const [loading, setLoading] = useState(true);
  const [companionRequests, setCompanionRequests] = useState<ClientCompanionRequest[]>([]);
  const [waitingManagerApproval, setWaitingManagerApproval] = useState(false);
  const { meetings } = useMeetings(id);

  // Local SQLite is the primary read path (ADR-001/T-003) — a `pending`
  // (not-yet-synced) client only ever exists here until the outbox pushes it.
  const loadClient = useCallback(async () => {
    if (!id) return;
    const foundClient = await getClientById(id);
    setClient(foundClient);
    setLoading(false);
  }, [id]);

  useEffect(() => {
    loadClient();
  }, [loadClient]);

  // ADR-030 Pass 2: requester-side companion-request chip. `profileId` is
  // the requester identity (ADR-023) — a companion request another agent
  // made naming this client isn't this agent's to see here.
  const loadCompanionRequests = useCallback(async () => {
    if (!id || !profileId) return;
    setCompanionRequests(await getClientCompanionRequests(id, profileId));
  }, [id, profileId]);

  // F-204: single-client check via the batch query — this screen only ever
  // needs its own client's membership, so re-using the Set-returning helper
  // (rather than adding a second single-row query function) keeps one
  // source of truth for the WHERE clause.
  const loadWaitingManagerApproval = useCallback(async () => {
    if (!id || !profileId) return;
    const ids = await getClientIdsWithPendingManagerTagAlong(profileId);
    setWaitingManagerApproval(ids.has(id));
  }, [id, profileId]);

  useEffect(() => {
    loadCompanionRequests();
  }, [loadCompanionRequests]);

  useEffect(() => {
    loadWaitingManagerApproval();
  }, [loadWaitingManagerApproval]);

  // Refresh after Complete Info saves and navigates back.
  useFocusEffect(
    useCallback(() => {
      loadClient();
      loadCompanionRequests();
      loadWaitingManagerApproval();
    }, [loadClient, loadCompanionRequests, loadWaitingManagerApproval])
  );

  if (loading) {
    return (
      <YStack flex={1} justifyContent="center" alignItems="center" backgroundColor={BIZLINK_COLORS.canvas}>
        <Spinner size="large" color={BIZLINK_COLORS.brand} />
      </YStack>
    );
  }

  if (!client) {
    return (
      <YStack flex={1} justifyContent="center" alignItems="center" padding="$6" backgroundColor={BIZLINK_COLORS.canvas}>
        <Text fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.text}>Client not found.</Text>
      </YStack>
    );
  }

  const status = getClientStatus(client);
  const badge = CLIENT_STATUS_BADGES[status];
  const checklist = getInfoChecklist(client);
  const { presented, total } = getClientProgressBreakdown(client, meetings);
  const progress = total;

  return (
    <YStack flex={1} backgroundColor={BIZLINK_COLORS.canvas} paddingTop={insets.top}>
      <BizTopBar title="Client" right={<BizLockButton />} />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}>
        <BizCard flexDirection="row" alignItems="center" gap="$3.5">
          <ProgressRing percent={progress} />
          <YStack flex={1} gap="$1.5">
            <Text fontFamily={BIZLINK_FONTS.semibold} fontSize={17} color={BIZLINK_COLORS.text} lineHeight={20}>
              {client.company_name}
            </Text>
            <XStack gap="$1.5" flexWrap="wrap">
              <StatusBadge {...badge} />
              {/* F-204: overlay badge alongside (not replacing) the status pill. */}
              {waitingManagerApproval ? (
                <StatusBadge
                  label={WAITING_MANAGER_APPROVAL_BADGE.label}
                  background={BIZLINK_COLORS[WAITING_MANAGER_APPROVAL_BADGE.background]}
                  color={BIZLINK_COLORS[WAITING_MANAGER_APPROVAL_BADGE.color]}
                />
              ) : null}
              {client.sales_channel ? (
                <StatusBadge label={client.sales_channel} background={BIZLINK_COLORS.soft} color={BIZLINK_COLORS.navy} />
              ) : null}
            </XStack>
            {/* States plainly that the ring is a Record Meeting -> Agenda
                outcome, not an info-completion score (B-001, corrected
                2026-07-11 — info completion has zero weight here). */}
            <StatusBadge
              label={presented ? 'Product presentation done (Record Meeting)' : 'Walang product presentation pa — 0%'}
              background={presented ? BIZLINK_COLORS.tintA : BIZLINK_COLORS.soft}
              color={presented ? BIZLINK_COLORS.ink : BIZLINK_COLORS.muted}
            />
          </YStack>
        </BizCard>

        {/* ADR-030 Pass 2: requester-side companion-request status — no
            literal wireframe markup exists for client-detail specifically
            (only Complete Info's picker + the Notifications accept/decline
            card are wireframed), but Decisions.md ADR-030 decision 6(d)
            explicitly specs a client-detail status chip as part of the
            reconciliation flow. Built with only already-approved primitives
            (BizSectionHeader + StatusBadge, both used elsewhere on this
            screen) rather than any new control. */}
        {companionRequests.length > 0 ? (
          <>
            <BizSectionHeader title="Kasama sa visit" />
            <BizCard gap="$2">
              {companionRequests.map((request) => {
                const displayStatus = companionRequestDisplayStatus(request);
                const tone = COMPANION_REQUEST_BADGE_TONES[displayStatus];
                return (
                  <XStack key={request.id} alignItems="center" justifyContent="space-between" gap="$2.5">
                    <Text fontSize={13.5} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.text} flex={1}>
                      {request.inviteeName ?? 'Kasama'}
                    </Text>
                    <StatusBadge
                      label={COMPANION_REQUEST_STATUS_LABELS[displayStatus]}
                      background={BIZLINK_COLORS[tone.background]}
                      color={BIZLINK_COLORS[tone.color]}
                    />
                  </XStack>
                );
              })}
            </BizCard>
          </>
        ) : null}

        <BizSectionHeader
          title="Info completion"
          helper={status === 'prospect' ? '1-month rule' : undefined}
        />
        <Text fontSize={12} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted} marginTop={-6} marginBottom="$2">
          Para lang ito sa 1-month data-quality rule — hiwalay na sa progress % sa taas (B-001).
        </Text>
        <BizCard>
          {checklist.map((item, index) => (
            <XStack
              key={item.key}
              alignItems="center"
              gap="$2.5"
              paddingVertical={10}
              borderBottomWidth={index === checklist.length - 1 ? 0 : 1}
              borderBottomColor={BIZLINK_COLORS.line}
            >
              <View
                width={22}
                height={22}
                borderRadius={11}
                backgroundColor={item.done ? BIZLINK_COLORS.brand : BIZLINK_COLORS.soft}
                alignItems="center"
                justifyContent="center"
              >
                {item.done ? <Check size={12} color={BIZLINK_COLORS.card} strokeWidth={1.75} /> : null}
              </View>
              <Text
                fontSize={13.5}
                fontFamily={BIZLINK_FONTS.medium}
                color={item.done ? BIZLINK_COLORS.text : BIZLINK_COLORS.muted}
              >
                {item.label}
              </Text>
            </XStack>
          ))}
        </BizCard>

        {/* Two primary actions side-by-side (Wireframe a-detail, ~line 521-524).
            Record Meeting is hidden here once status !== 'prospect' (revised
            2026-07-21 — 'new' now shares 'existing's fast path, ADR-015) —
            those clients log visits solely through My Meetings (2026-07-15
            wireframe note), so there is only one entry point instead of two. */}
        <XStack gap="$2.5" marginTop="$3.5">
          <YStack flex={1}>
            <BizButton
              label="Edit info"
              variant="white"
              icon={<Pencil size={15} color={BIZLINK_COLORS.text} strokeWidth={1.75} />}
              onPress={() => router.push(routes.completeInfo(client.id))}
            />
          </YStack>
          {status === 'prospect' ? (
            <YStack flex={1}>
              <BizButton
                label="Record meeting"
                icon={<Camera size={15} color={BIZLINK_COLORS.card} strokeWidth={1.75} />}
                onPress={() => router.push(routes.recordMeeting(client.id))}
              />
            </YStack>
          ) : null}
        </XStack>

        <BizSectionHeader title="Meeting history" />
        {meetings.length === 0 ? (
          <Text fontSize={13} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted}>
            Wala pang meetings sa client na ito.
          </Text>
        ) : (
          meetings.map((meeting) => {
            const outcomeStyle = meeting.outcome ? OUTCOME_BADGE_STYLES[meeting.outcome] : null;
            return (
              <Pressable key={meeting.id} onPress={() => router.push(routes.meetingDetail(meeting.id))}>
                <XStack
                  alignItems="flex-start"
                  gap="$3"
                  backgroundColor={BIZLINK_COLORS.card}
                  borderRadius={20}
                  padding={14}
                  marginBottom={10}
                >
                  <YStack flex={1} gap="$0.5">
                    <Text fontFamily={BIZLINK_FONTS.semibold} fontSize={14} color={BIZLINK_COLORS.text}>
                      {new Date(meeting.logged_at).toLocaleDateString()}
                    </Text>
                    <Text fontSize={11.5} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted}>
                      {new Date(meeting.logged_at).toLocaleTimeString()}
                    </Text>
                  </YStack>
                  {outcomeStyle && meeting.outcome ? (
                    <StatusBadge label={meeting.outcome} {...outcomeStyle} />
                  ) : (
                    <StatusBadge label="Photo visit" background={BIZLINK_COLORS.tintA} color={BIZLINK_COLORS.ink} />
                  )}
                </XStack>
              </Pressable>
            );
          })
        )}
      </ScrollView>
    </YStack>
  );
}
