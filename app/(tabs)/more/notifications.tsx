import { useCallback, useState } from 'react';
import { ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { AlertTriangle, Bell, CircleAlert, RefreshCw, Users } from 'lucide-react-native';
import { Spinner, Text, XStack, YStack } from 'tamagui';
import { BIZLINK_COLORS, BIZLINK_FONTS } from '../../../lib/theme';
import { getOutboxCounts, type OutboxCounts } from '../../../lib/sync-engine';
import { getRecentCompanionTagsForInvitee, type RecentManagerTag } from '../../../lib/tag-along-invitee-service';
import { useSession } from '../../../lib/session-store';
import { BizTopBar } from '../../../components/bizlink/BizTopBar';

/**
 * Wireframe `id="a-notifications"` (`aRenderNotifications()`, ~line 1036)
 * mocks a richer feed (deadline reminders, tag-along updates, approvals) —
 * most of that still has no real client-side data source (deadline
 * countdown is T-018, approvals no longer exist at all per F-205). Tag-along
 * updates DO now have a real source (F-205 / B-053) — a manager tagging this
 * agent directly into their own meeting (`insertAcceptedMeetingCompanions()`)
 * — so this screen is scoped to what's genuinely derivable: real
 * sync-outbox counts (`getOutboxCounts()`, same source as the Home screen's
 * sync chip) plus this agent's own recent manager tag-alongs.
 */
export default function NotificationsScreen() {
  const insets = useSafeAreaInsets();
  const { profileId } = useSession();
  const [counts, setCounts] = useState<OutboxCounts | null>(null);
  const [managerTags, setManagerTags] = useState<RecentManagerTag[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      getOutboxCounts(),
      profileId ? getRecentCompanionTagsForInvitee(profileId) : Promise.resolve([]),
    ])
      .then(([outboxCounts, tags]) => {
        setCounts(outboxCounts);
        setManagerTags(tags);
      })
      .finally(() => setLoading(false));
  }, [profileId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const items: Array<{ icon: React.ReactNode; title: string; body: string }> = [];
  if (counts) {
    if (counts.failed > 0) {
      items.push({
        icon: <AlertTriangle size={16} color={BIZLINK_COLORS.red} strokeWidth={1.75} />,
        title: `${counts.failed} record${counts.failed === 1 ? '' : 's'} failed to sync`,
        body: 'Needs attention — check Sync History for details.',
      });
    }
    if (counts.conflict > 0) {
      items.push({
        icon: <CircleAlert size={16} color={BIZLINK_COLORS.orange} strokeWidth={1.75} />,
        title: `${counts.conflict} sync conflict${counts.conflict === 1 ? '' : 's'}`,
        body: 'A record was changed on both the device and the server.',
      });
    }
    if (counts.pending > 0) {
      items.push({
        icon: <RefreshCw size={16} color={BIZLINK_COLORS.brand} strokeWidth={1.75} />,
        title: `${counts.pending} record${counts.pending === 1 ? '' : 's'} queued for sync`,
        body: 'Auto-uploads kapag may signal.',
      });
    }
  }
  for (const tag of managerTags) {
    const managerName = tag.requesterName ?? 'Manager mo';
    items.push({
      icon: <Users size={16} color={BIZLINK_COLORS.brand} strokeWidth={1.75} />,
      title: `${managerName} tinag ka sa isang meeting`,
      body: tag.clientName ? `${tag.clientName} — ${new Date(tag.createdAt).toLocaleDateString()}` : new Date(tag.createdAt).toLocaleDateString(),
    });
  }

  return (
    <YStack flex={1} backgroundColor={BIZLINK_COLORS.canvas} paddingTop={insets.top}>
      <BizTopBar title="Notifications" fallbackHref="/(tabs)/more" />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}>
        {loading && !counts ? (
          <YStack alignItems="center" padding="$8">
            <Spinner size="large" color={BIZLINK_COLORS.brand} />
          </YStack>
        ) : items.length === 0 ? (
          <YStack alignItems="center" padding="$8" gap="$2.5">
            <Bell size={40} color={BIZLINK_COLORS.muted} strokeWidth={1.75} />
            <Text fontSize={13} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted} textAlign="center">
              Wala pang sync alerts.
            </Text>
          </YStack>
        ) : (
          items.map((item, index) => (
            <XStack
              key={index}
              gap="$3"
              alignItems="flex-start"
              backgroundColor={BIZLINK_COLORS.card}
              borderRadius={20}
              padding={16}
              marginTop={index === 0 ? 0 : 10}
            >
              {item.icon}
              <YStack flex={1} gap="$1">
                <Text fontFamily={BIZLINK_FONTS.semibold} fontSize={13.5} color={BIZLINK_COLORS.text}>
                  {item.title}
                </Text>
                <Text fontSize={12} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted} lineHeight={17}>
                  {item.body}
                </Text>
              </YStack>
            </XStack>
          ))
        )}
      </ScrollView>
    </YStack>
  );
}
