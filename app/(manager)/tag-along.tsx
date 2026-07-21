import { useCallback, useEffect, useState } from 'react';
import { ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { CircleCheckBig, Handshake } from 'lucide-react-native';
import { Spinner, Text, XStack, YStack } from 'tamagui';
import { BIZLINK_COLORS, BIZLINK_FONTS } from '../../lib/theme';
import { agentById, clientById } from '../../lib/manager-data';
import { useManagerStore } from '../../lib/manager-store';
import { useSession } from '../../lib/session-store';
import {
  getIncomingCompanionRequests,
  updateCompanionRequestStatus,
  StaleCompanionRequestError,
  type IncomingCompanionRequest,
} from '../../lib/tag-along-invitee-service';
import {
  companionRequestDisplayStatus,
  COMPANION_REQUEST_STATUS_LABELS,
  COMPANION_REQUEST_BADGE_TONES,
} from '../../lib/tag-along-service';
import { BizButton } from '../../components/bizlink/BizButton';
import { Avatar } from '../../components/ui/Avatar';
import { StatusBadge } from '../../components/ui/StatusBadge';

/**
 * Wireframe s-tagalong — ungated: accept/decline only, the sales rep still
 * owns and records the meeting (Meeting-2026-07-08, final single-owner model).
 *
 * B-053 (ADR-030 Pass 3): the top "Mga request" section now reads real
 * incoming companion requests (`lib/tag-along-invitee-service.ts`) instead of
 * `useManagerStore()`'s mock `tagAlongRequests`. The second section ("Mga
 * natapos na meeting") is intentionally left untouched — still mock-backed,
 * tracked separately as B-054.
 */
export default function TagAlongRequestsScreen() {
  const insets = useSafeAreaInsets();
  const { profileId } = useSession();
  const { approvals } = useManagerStore();
  const pendingTagAlongApprovals = approvals.filter((a) => a.type === 'tagalong');

  const [requests, setRequests] = useState<IncomingCompanionRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [respondingId, setRespondingId] = useState<string | null>(null);
  const [respondError, setRespondError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!profileId) return;
    try {
      const all = await getIncomingCompanionRequests(profileId);
      setRequests(all.filter((r) => r.status === 'pending'));
      setLoadError(false);
    } catch (err) {
      console.error('[ManagerTagAlong] load failed:', err instanceof Error ? err.message : String(err));
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, [profileId]);

  useEffect(() => {
    load();
  }, [load]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  async function respond(requestId: string, decision: 'accepted' | 'declined'): Promise<void> {
    if (!profileId) return;
    setRespondingId(requestId);
    setRespondError(null);
    try {
      await updateCompanionRequestStatus({ requestId, actorProfileId: profileId, decision });
      await load();
    } catch (err) {
      if (err instanceof StaleCompanionRequestError) {
        await load();
      } else {
        setRespondError(err instanceof Error ? err.message : String(err));
      }
    } finally {
      setRespondingId(null);
    }
  }

  return (
    <YStack flex={1} backgroundColor={BIZLINK_COLORS.canvas} paddingTop={insets.top}>
      <XStack alignItems="center" paddingHorizontal="$4" paddingTop="$2.5" paddingBottom="$1.5">
        <Text fontFamily={BIZLINK_FONTS.semibold} fontSize={21} color={BIZLINK_COLORS.text}>Tag-Along Requests</Text>
      </XStack>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}>
        <Text fontSize={13} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted} marginBottom="$3" lineHeight={19}>
          Hindi ka na gumagawa ng sariling meeting record. Ang sales rep ang nagre-record ng buong client visit
          (kasama ka sa litrato niya bilang proof) — dito mo lang ito ku-kumpirmahin na sumama ka pagkatapos ng
          meeting mismo, at ia-approve o irereject pagkatapos ang buong record.
        </Text>

        <SectionLabel title="Mga request — kumpirmahin na sumama ka" />
        {loading ? (
          <YStack alignItems="center" paddingVertical="$5">
            <Spinner size="large" color={BIZLINK_COLORS.brand} />
          </YStack>
        ) : loadError ? (
          <YStack alignItems="center" paddingVertical="$5" gap="$3">
            <Text fontSize={13} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted} textAlign="center">
              Hindi na-load ang mga request.
            </Text>
            <BizButton small label="Ulitin" variant="white" onPress={load} />
          </YStack>
        ) : requests.length === 0 ? (
          <EmptyState label="Walang naghihintay na request." />
        ) : (
          <>
            {respondError ? (
              <Text fontSize={12.5} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.red} marginBottom="$2">
                {respondError}
              </Text>
            ) : null}
            {requests.map((r) => {
              const requesterName = r.requesterName ?? 'Agent';
              const clientName = r.clientName ?? 'Client';
              const isResponding = respondingId === r.id;
              const displayStatus = companionRequestDisplayStatus(r);
              const tone = COMPANION_REQUEST_BADGE_TONES[displayStatus];
              return (
                <YStack key={r.id} backgroundColor={BIZLINK_COLORS.card} borderRadius={20} padding={16} marginBottom={10}>
                  <XStack alignItems="center" gap="$3" marginBottom="$2">
                    <Avatar
                      initials={requesterName.slice(0, 2).toUpperCase()}
                      size="sm"
                      background={BIZLINK_COLORS.soft}
                      color={BIZLINK_COLORS.ink}
                    />
                    <YStack flex={1}>
                      <StatusBadge
                        label={COMPANION_REQUEST_STATUS_LABELS[displayStatus]}
                        background={BIZLINK_COLORS[tone.background]}
                        color={BIZLINK_COLORS[tone.color]}
                      />
                      <Text fontFamily={BIZLINK_FONTS.semibold} fontSize={14} color={BIZLINK_COLORS.text} marginTop={2}>
                        {clientName}
                      </Text>
                    </YStack>
                  </XStack>
                  <Text fontSize={12.5} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted} marginBottom={6}>
                    Kasama sana kita: <Text color={BIZLINK_COLORS.text} fontFamily={BIZLINK_FONTS.semibold}>{requesterName}</Text>
                  </Text>
                  <XStack gap="$2" marginTop="$2">
                    <BizButton
                      label="Decline"
                      variant="white"
                      small
                      disabled={isResponding}
                      onPress={() => respond(r.id, 'declined')}
                      style={{ flex: 1 }}
                    />
                    <BizButton
                      label="Accept"
                      small
                      disabled={isResponding}
                      onPress={() => respond(r.id, 'accepted')}
                      style={{ flex: 1 }}
                    />
                  </XStack>
                </YStack>
              );
            })}
          </>
        )}

        <SectionLabel title="Mga natapos na meeting — kailangan ng approval mo" />
        <Text fontSize={12} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted} marginBottom="$2">Makikita rin ito sa Approvals tab.</Text>
        {pendingTagAlongApprovals.length === 0 ? (
          <EmptyState icon={<Handshake size={28} color={BIZLINK_COLORS.muted} strokeWidth={1.75} />} label="Walang tag-along meeting na naghihintay ng approval." />
        ) : (
          pendingTagAlongApprovals.map((a) => {
            const client = clientById(a.clientId);
            const agent = agentById(a.agentId);
            return (
              <XStack
                key={a.id}
                alignItems="center"
                gap="$3"
                backgroundColor={BIZLINK_COLORS.card}
                borderRadius={20}
                padding={14}
                marginBottom={10}
                onPress={() => router.push('/(manager)/approvals')}
              >
                <YStack flex={1}>
                  <Text fontFamily={BIZLINK_FONTS.semibold} fontSize={14} color={BIZLINK_COLORS.text}>{client?.name}</Text>
                  <Text fontSize={11.5} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted}>{agent?.name} · {a.requested}</Text>
                </YStack>
                <StatusBadge label="Pending approval" background={BIZLINK_COLORS.tintA} color={BIZLINK_COLORS.brand} />
              </XStack>
            );
          })
        )}
      </ScrollView>
    </YStack>
  );
}

function SectionLabel({ title }: { title: string }) {
  return (
    <Text fontFamily={BIZLINK_FONTS.semibold} fontSize={16} color={BIZLINK_COLORS.text} marginTop="$4" marginBottom="$2">{title}</Text>
  );
}

function EmptyState({ icon, label }: { icon?: React.ReactNode; label: string }) {
  return (
    <YStack alignItems="center" paddingVertical="$5" gap="$2">
      {icon ?? <CircleCheckBig size={28} color={BIZLINK_COLORS.muted} strokeWidth={1.75} />}
      <Text fontSize={13} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted} textAlign="center">{label}</Text>
    </YStack>
  );
}
