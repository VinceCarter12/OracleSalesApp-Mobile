import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { CircleCheckBig, Clock, History } from 'lucide-react-native';
import { Spinner, Text, View, XStack, YStack } from 'tamagui';
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
import { BizFloatingPager } from '../../../components/bizlink/BizFloatingPager';

type FilterTab = 'pending' | 'accepted' | 'history';
const ITEMS_PER_PAGE = 10;

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
  const [activeTab, setActiveTab] = useState<FilterTab>('pending');
  const [currentPage, setCurrentPage] = useState(0);

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

  // Get filtered requests based on active tab
  const filteredRequests = activeTab === 'pending' ? pending : activeTab === 'accepted' ? accepted : history;
  
  // Pagination
  const totalPages = Math.ceil(filteredRequests.length / ITEMS_PER_PAGE);
  const paginatedRequests = filteredRequests.slice(
    currentPage * ITEMS_PER_PAGE,
    (currentPage + 1) * ITEMS_PER_PAGE
  );

  // Reset page when changing tabs
  const handleTabChange = (tab: FilterTab) => {
    setActiveTab(tab);
    setCurrentPage(0);
  };

  return (
    <YStack flex={1} backgroundColor={BIZLINK_COLORS.canvas} paddingTop={insets.top}>
      <BizTopBar title="Tag-Along Status" />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 120 }}>
        <Text fontSize={13} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted} marginBottom="$3" lineHeight={19}>
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
            <XStack alignItems="center" marginBottom="$2">
              <Text fontSize={14} fontFamily={BIZLINK_FONTS.semibold} color={BIZLINK_COLORS.text}>
                Mga request mo
              </Text>
            </XStack>

            {/* Filter Tabs */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
              <XStack gap="$2">
                <Pressable
                  onPress={() => handleTabChange('pending')}
                  style={{
                    paddingHorizontal: 16,
                    paddingVertical: 8,
                    borderRadius: 999,
                    backgroundColor: activeTab === 'pending' ? BIZLINK_COLORS.brand : BIZLINK_COLORS.card,
                  }}
                >
                  <Text
                    fontSize={13}
                    fontFamily={BIZLINK_FONTS.semibold}
                    color={activeTab === 'pending' ? '#FFFFFF' : BIZLINK_COLORS.text}
                  >
                    Pending ({pending.length})
                  </Text>
                </Pressable>
                
                <Pressable
                  onPress={() => handleTabChange('accepted')}
                  style={{
                    paddingHorizontal: 16,
                    paddingVertical: 8,
                    borderRadius: 999,
                    backgroundColor: activeTab === 'accepted' ? BIZLINK_COLORS.brand : BIZLINK_COLORS.card,
                  }}
                >
                  <Text
                    fontSize={13}
                    fontFamily={BIZLINK_FONTS.semibold}
                    color={activeTab === 'accepted' ? '#FFFFFF' : BIZLINK_COLORS.text}
                  >
                    Accepted ({accepted.length})
                  </Text>
                </Pressable>
                
                <Pressable
                  onPress={() => handleTabChange('history')}
                  style={{
                    paddingHorizontal: 16,
                    paddingVertical: 8,
                    borderRadius: 999,
                    backgroundColor: activeTab === 'history' ? BIZLINK_COLORS.brand : BIZLINK_COLORS.card,
                  }}
                >
                  <Text
                    fontSize={13}
                    fontFamily={BIZLINK_FONTS.semibold}
                    color={activeTab === 'history' ? '#FFFFFF' : BIZLINK_COLORS.text}
                  >
                    History ({history.length})
                  </Text>
                </Pressable>
              </XStack>
            </ScrollView>

            {/* Request Cards */}
            <YStack gap="$2">
              {filteredRequests.length === 0 ? (
                <EmptyState
                  icon={
                    activeTab === 'pending' ? (
                      <Clock size={28} color={BIZLINK_COLORS.muted} strokeWidth={1.75} />
                    ) : activeTab === 'accepted' ? (
                      <CircleCheckBig size={28} color={BIZLINK_COLORS.muted} strokeWidth={1.75} />
                    ) : (
                      <History size={28} color={BIZLINK_COLORS.muted} strokeWidth={1.75} />
                    )
                  }
                  label={
                    activeTab === 'pending'
                      ? 'Walang naghihintay na request.'
                      : activeTab === 'accepted'
                      ? 'Wala pang tumatanggap na kasama.'
                      : 'Wala pang tapos na request.'
                  }
                />
              ) : (
                paginatedRequests.map((request) => <RequestRow key={request.id} request={request} />)
              )}
            </YStack>
          </>
        )}
      </ScrollView>

      {!loading && !loadError && totalPages > 0 && (
        <BizFloatingPager
          page={currentPage + 1}
          totalPages={totalPages}
          onPageChange={(p) => setCurrentPage(p - 1)}
          bottomOffset={insets.bottom + 16}
        />
      )}
    </YStack>
  );
}

function RequestRow({ request }: { request: MyCompanionRequest }) {
  const displayStatus = companionRequestDisplayStatus(request);
  const tone = COMPANION_REQUEST_BADGE_TONES[displayStatus];
  const name = request.inviteeName ?? 'Kasama';
  const role = request.inviteeKind === 'manager' ? 'Manager' : 'Teammate';
  const clientId = request.clientId;

  const handlePress = () => {
    if (clientId) {
      router.push(`/(tabs)/clients/${clientId}`);
    }
  };

  return (
    <Pressable onPress={handlePress}>
      <View
        backgroundColor={BIZLINK_COLORS.card}
        borderRadius={20}
        padding={14}
        marginBottom={10}
      >
        <XStack alignItems="center" gap="$3">
          <Avatar initials={name.slice(0, 2).toUpperCase()} size="md" background={BIZLINK_COLORS.soft} color={BIZLINK_COLORS.ink} />
          <YStack flex={1} gap="$1">
            <Text fontFamily={BIZLINK_FONTS.semibold} fontSize={14} color={BIZLINK_COLORS.text}>{name}</Text>
            <Text fontSize={12} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted}>
              {role}
            </Text>
            {request.clientName && (
              <Text fontSize={11.5} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted}>
                {request.clientName}
              </Text>
            )}
          </YStack>
          <StatusBadge
            label={COMPANION_REQUEST_STATUS_LABELS[displayStatus]}
            background={BIZLINK_COLORS[tone.background]}
            color={BIZLINK_COLORS[tone.color]}
          />
        </XStack>
      </View>
    </Pressable>
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
