import { useCallback, useState } from 'react';
import { ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { AlertTriangle, Bell, CircleAlert, RefreshCw } from 'lucide-react-native';
import { Spinner, Text, XStack, YStack } from 'tamagui';
import { BIZLINK_COLORS, BIZLINK_FONTS } from '../../../lib/theme';
import { getOutboxCounts, type OutboxCounts } from '../../../lib/sync-engine';
import { BizTopBar } from '../../../components/bizlink/BizTopBar';

/**
 * Wireframe `id="a-notifications"` (`aRenderNotifications()`, ~line 1036)
 * mocks a richer feed (deadline reminders, tag-along updates, approvals) —
 * none of that has a real client-side data source yet (deadline countdown
 * is T-018, tag-along/approval events aren't tracked locally at all). To
 * avoid inventing a fake backend, this screen is deliberately scoped to
 * what's genuinely derivable right now: real sync-outbox counts
 * (`getOutboxCounts()`), same source as the Home screen's sync chip.
 */
export default function NotificationsScreen() {
  const insets = useSafeAreaInsets();
  const [counts, setCounts] = useState<OutboxCounts | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    getOutboxCounts()
      .then(setCounts)
      .finally(() => setLoading(false));
  }, []);

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
