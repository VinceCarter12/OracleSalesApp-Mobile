import { useCallback, useEffect, useState } from 'react';
import { ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { CircleCheckBig, Clock, History } from 'lucide-react-native';
import { Spinner, Text, XStack, YStack } from 'tamagui';
import { useSession } from '../../../lib/session-store';
import {
  getMyCompanionRequests,
  companionRequestDisplayStatus,
  COMPANION_REQUEST_STATUS_LABELS,
  COMPANION_REQUEST_BADGE_TONES,
  type MyCompanionRequest,
} from '../../../lib/tag-along-service';
import { BIZLINK_COLORS, BIZLINK_FONTS } from '../../../lib/theme';
import { BizTopBar } from '../../../components/bizlink/BizTopBar';
import { BizSectionHeader } from '../../../components/bizlink/BizSectionHeader';
import { BizButton } from '../../../components/bizlink/BizButton';
import { Avatar } from '../../../components/ui/Avatar';
import { StatusBadge } from '../../../components/ui/StatusBadge';

/**
 * "Tag-Along Status" (ADR-030 Pass 2.5, full rewrite from the old mock
 * send-request form): view-only status center for companion requests THIS
 * agent has made. Record Meeting's "Kasama sa visit" picker is now the sole
 * entry point for creating a request — nothing here sends one.
 */
export default function TagAlongScreen() {
  const insets = useSafeAreaInsets();
  const { profileId } = useSession();
  const [requests, setRequests] = useState<MyCompanionRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  const load = useCallback(async () => {
    if (!profileId) return;
    try {
      setRequests(await getMyCompanionRequests(profileId));
      setLoadError(false);
    } catch (err) {
      console.error('[TagAlongStatus] load failed:', err instanceof Error ? err.message : String(err));
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

  const pending = requests.filter((r) => {
    const status = companionRequestDisplayStatus(r);
    return status === 'pending_offline' || status === 'pending_synced';
  });
  const accepted = requests.filter((r) => companionRequestDisplayStatus(r) === 'accepted');
  const history = requests.filter((r) => {
    const status = companionRequestDisplayStatus(r);
    return status === 'declined' || status === 'cancelled';
  });

  return (
    <YStack flex={1} backgroundColor={BIZLINK_COLORS.canvas} paddingTop={insets.top}>
      <BizTopBar title="Tag-Along Status" />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32 }}>
        <Text fontSize={13} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted} marginBottom="$2" lineHeight={19}>
          Makikita dito ang mga kasamang hiniling mo — pumili sa Record Meeting screen kapag may susunod kang
          i-record na visit. Dito mo lang mabantayan kung tinanggap na, at ang kasaysayan ng mga naunang request.
        </Text>

        {loading ? (
          <YStack alignItems="center" paddingVertical="$6">
            <Spinner size="large" color={BIZLINK_COLORS.brand} />
          </YStack>
        ) : loadError ? (
          <YStack alignItems="center" paddingVertical="$6" gap="$3">
            <Text fontSize={13} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted} textAlign="center">
              Hindi na-load ang mga request mo.
            </Text>
            <BizButton small label="Ulitin" variant="white" onPress={load} />
          </YStack>
        ) : (
          <>
            <BizSectionHeader title="Pending" />
            {pending.length === 0 ? (
              <EmptyState icon={<Clock size={28} color={BIZLINK_COLORS.muted} strokeWidth={1.75} />} label="Walang naghihintay na request." />
            ) : (
              pending.map((request) => <RequestRow key={request.id} request={request} />)
            )}

            <BizSectionHeader title="Accepted" />
            {accepted.length === 0 ? (
              <EmptyState icon={<CircleCheckBig size={28} color={BIZLINK_COLORS.muted} strokeWidth={1.75} />} label="Wala pang tumatanggap na kasama." />
            ) : (
              accepted.map((request) => <RequestRow key={request.id} request={request} />)
            )}

            <BizSectionHeader title="History" />
            {history.length === 0 ? (
              <EmptyState icon={<History size={28} color={BIZLINK_COLORS.muted} strokeWidth={1.75} />} label="Wala pang tapos na request." />
            ) : (
              history.map((request) => <RequestRow key={request.id} request={request} />)
            )}
          </>
        )}
      </ScrollView>
    </YStack>
  );
}

function RequestRow({ request }: { request: MyCompanionRequest }) {
  const displayStatus = companionRequestDisplayStatus(request);
  const tone = COMPANION_REQUEST_BADGE_TONES[displayStatus];
  const name = request.inviteeName ?? 'Kasama';
  return (
    <XStack
      alignItems="center"
      gap="$3"
      backgroundColor={BIZLINK_COLORS.card}
      borderRadius={20}
      padding={14}
      marginBottom={10}
      minHeight={44}
    >
      <Avatar initials={name.slice(0, 2).toUpperCase()} size="sm" background={BIZLINK_COLORS.soft} color={BIZLINK_COLORS.ink} />
      <YStack flex={1}>
        <Text fontFamily={BIZLINK_FONTS.semibold} fontSize={13.5} color={BIZLINK_COLORS.text}>{name}</Text>
        <Text fontSize={11} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted}>
          {request.clientName ?? 'Client'}
        </Text>
      </YStack>
      <StatusBadge
        label={COMPANION_REQUEST_STATUS_LABELS[displayStatus]}
        background={BIZLINK_COLORS[tone.background]}
        color={BIZLINK_COLORS[tone.color]}
      />
    </XStack>
  );
}

function EmptyState({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <YStack alignItems="center" paddingVertical="$5" gap="$2" marginBottom="$2">
      {icon}
      <Text fontSize={13} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted} textAlign="center">{label}</Text>
    </YStack>
  );
}
