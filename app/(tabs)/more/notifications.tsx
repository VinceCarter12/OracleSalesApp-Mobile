import { useCallback, useState } from 'react';
import { Pressable, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import type { Href } from 'expo-router';
import { AlertTriangle, Bell, CircleAlert, FileCheck2, RefreshCw, Users } from 'lucide-react-native';
import { Spinner, Text, XStack, YStack } from 'tamagui';
import { BIZLINK_COLORS, BIZLINK_FONTS } from '../../../lib/theme';
import { getOutboxCounts, type OutboxCounts } from '../../../lib/sync-engine';
import { getRecentCompanionTagsForInvitee, type RecentManagerTag } from '../../../lib/tag-along-invitee-service';
import { getMyPoConfirmationStatuses, type PoConfirmationRecord } from '../../../lib/po-confirmation-service';
import { PO_CONFIRMATION_STATUS_LABELS, PO_CONFIRMATION_BADGE_TONES } from '../../../lib/policies/po-confirmation-status-policy';
import { getClientById } from '../../../lib/client-service';
import { useSession } from '../../../lib/session-store';
import { useClientFlowRoutes } from '../../../lib/use-role-routes';
import { BizTopBar } from '../../../components/bizlink/BizTopBar';

/**
 * Wireframe `id="a-notifications"` (`aRenderNotifications()`, ~line 1159)
 * mocks a richer feed (deadline reminders, tag-along updates, approvals) —
 * most of that still has no real client-side data source (deadline
 * countdown is T-018, approvals no longer exist at all per F-205). Tag-along
 * updates DO now have a real source (F-205 / B-053) — a manager tagging this
 * agent directly into their own meeting (`insertAcceptedMeetingCompanions()`)
 * — as does PO confirmation status (ADR-046 point 7, Batch 3 Slice 5) via
 * `getMyPoConfirmationStatuses()` — so this screen is scoped to what's
 * genuinely derivable: real sync-outbox counts (`getOutboxCounts()`, same
 * source as the Home screen's sync chip), this agent's own recent manager
 * tag-alongs, and this agent's own PO confirmation request statuses. Every
 * item here follows the wireframe's card shape 1:1 (icon + title + body,
 * `aRenderNotifications()` lines 1181-1184) — no tap target/action, since
 * the wireframe only wires Accept/Decline actions to `n.companionRequestId`
 * (F-015/ADR-030), never to a PO confirmation row.
 */
export default function NotificationsScreen() {
  const insets = useSafeAreaInsets();
  const { profileId } = useSession();
  const clientFlowRoutes = useClientFlowRoutes();
  const [counts, setCounts] = useState<OutboxCounts | null>(null);
  const [managerTags, setManagerTags] = useState<RecentManagerTag[]>([]);
  const [poConfirmations, setPoConfirmations] = useState<Array<{ record: PoConfirmationRecord; clientName: string | null }>>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      getOutboxCounts(),
      profileId ? getRecentCompanionTagsForInvitee(profileId) : Promise.resolve([]),
      profileId ? getMyPoConfirmationStatuses(profileId) : Promise.resolve([]),
    ])
      .then(async ([outboxCounts, tags, poRecords]) => {
        setCounts(outboxCounts);
        setManagerTags(tags);
        const withClientNames = await Promise.all(
          poRecords.map(async (record) => ({
            record,
            clientName: (await getClientById(record.clientId))?.company_name ?? null,
          }))
        );
        setPoConfirmations(withClientNames);
      })
      .finally(() => setLoading(false));
  }, [profileId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  // Batch 7a: each item's `href` (when present) is its one authorized
  // navigation destination on tap — sync items go to the existing Sync
  // History screen (matching the "check Sync History for details" copy
  // already shown below), and client-scoped items (manager tag, PO evidence)
  // go to that client's own Client Detail. No item routes anywhere the
  // wireframe's own mock notification feed doesn't already imply via its
  // subject — this deliberately does NOT add unread/category filter chips
  // shown in `Wireframe-Sales-BizLink.html`'s `aRenderNotifications()`, since
  // this screen tracks no `unread`/`category` state to back them.
  const items: Array<{ icon: React.ReactNode; title: string; body: string; href?: Href }> = [];
  const syncHistoryHref = '/(tabs)/more/sync-history' as Href;
  if (counts) {
    if (counts.failed > 0) {
      items.push({
        icon: <AlertTriangle size={16} color={BIZLINK_COLORS.red} strokeWidth={1.75} />,
        title: `${counts.failed} record${counts.failed === 1 ? '' : 's'} failed to sync`,
        body: 'Needs attention — check Sync History for details.',
        href: syncHistoryHref,
      });
    }
    if (counts.conflict > 0) {
      items.push({
        icon: <CircleAlert size={16} color={BIZLINK_COLORS.orange} strokeWidth={1.75} />,
        title: `${counts.conflict} sync conflict${counts.conflict === 1 ? '' : 's'}`,
        body: 'A record was changed on both the device and the server.',
        href: syncHistoryHref,
      });
    }
    if (counts.pending > 0) {
      items.push({
        icon: <RefreshCw size={16} color={BIZLINK_COLORS.brand} strokeWidth={1.75} />,
        title: `${counts.pending} record${counts.pending === 1 ? '' : 's'} queued for sync`,
        body: 'Auto-uploads kapag may signal.',
        href: syncHistoryHref,
      });
    }
  }
  for (const tag of managerTags) {
    const managerName = tag.requesterName ?? 'Manager mo';
    items.push({
      icon: <Users size={16} color={BIZLINK_COLORS.brand} strokeWidth={1.75} />,
      title: `${managerName} tinag ka sa isang meeting`,
      body: tag.clientName ? `${tag.clientName} — ${new Date(tag.createdAt).toLocaleDateString()}` : new Date(tag.createdAt).toLocaleDateString(),
      href: tag.clientId ? clientFlowRoutes.clientDetail(tag.clientId) : undefined,
    });
  }
  for (const { record, clientName } of poConfirmations) {
    const tone = PO_CONFIRMATION_BADGE_TONES[record.displayStatus];
    items.push({
      icon: <FileCheck2 size={16} color={BIZLINK_COLORS[tone.color]} strokeWidth={1.75} />,
      title: clientName ? `PO evidence — ${clientName}` : 'PO evidence update',
      body: `${PO_CONFIRMATION_STATUS_LABELS[record.displayStatus]} — ${new Date(record.updatedAt).toLocaleDateString()}`,
      href: clientFlowRoutes.clientDetail(record.clientId),
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
          items.map((item, index) => {
            const card = (
              <XStack
                gap="$3"
                alignItems="flex-start"
                backgroundColor={BIZLINK_COLORS.card}
                borderRadius={20}
                padding={16}
                marginTop={index === 0 ? 0 : 10}
                minHeight={44}
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
            );
            return item.href ? (
              <Pressable key={index} onPress={() => router.push(item.href as Href)} hitSlop={4}>
                {card}
              </Pressable>
            ) : (
              <YStack key={index}>{card}</YStack>
            );
          })
        )}
      </ScrollView>
    </YStack>
  );
}
