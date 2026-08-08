import { useCallback, useEffect, useState } from 'react';
import { ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { Href } from 'expo-router';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { Check, Circle } from 'lucide-react-native';
import { Spinner, Text, XStack, YStack } from 'tamagui';
import { getClientById } from '../../../lib/client-service';
import { getClientStatus } from '../../../lib/client-status';
import { getClientJourneyProgress } from '../../../lib/client-progress';
import { useMeetings } from '../../../lib/useMeetings';
import { OUTCOME_BADGE_STYLES, useBizlinkColors, BIZLINK_FONTS } from '../../../lib/theme';
import { BizTopBar } from '../../../components/bizlink/BizTopBar';
import { BizSectionHeader } from '../../../components/bizlink/BizSectionHeader';
import { SelectedClientCard } from '../../../components/meetings/SelectedClientCard';
import { StatusBadge } from '../../../components/ui/StatusBadge';
import { SyncBadge } from '../../../components/sync/SyncBadge';
import type { OutboxStatus } from '../../../lib/sync/outbox-status';
import type { Client, Meeting } from '../../../types';

/** Mirrors [id].tsx's `formatMeetingLocation` — human-readable Location line for a journey timeline entry. */
function formatMeetingLocation(meeting: Meeting): string | null {
  if (!meeting.location_type) return null;
  return meeting.location_type === 'Others' ? (meeting.location_name || 'Others') : 'Client Office';
}

interface JourneyItem {
  key: string;
  title: string;
  detail: string;
  done: boolean;
  meeting?: Meeting;
}

/**
 * Wireframe `aOpenClientJourney()` (Wireframe-Sales-BizLink.html:2111-2130):
 * "Client created" (real `clients.created_at`), then every meeting reverse-
 * chronological, then lifecycle milestones derived from the client's CURRENT
 * status only. No lifecycle-transition table exists anywhere in this schema
 * (2026-08-04 handoff, explicit) — these milestone rows never carry a
 * fabricated timestamp, unlike "Client created" and the meeting rows, which
 * use real dates.
 */
function buildJourneyItems(client: Client, meetings: Meeting[]): JourneyItem[] {
  const items: JourneyItem[] = [
    {
      key: 'created',
      title: 'Client created',
      detail: 'Prospect stage started. Company and city saved locally.',
      done: true,
    },
  ];

  meetings.forEach((meeting) => {
    const outcomeLabel = meeting.outcome ?? 'Photo visit (fast path)';
    // DEVIATION from the wireframe's literal check (Wireframe-Sales-
    // BizLink.html:2124, `done:m.outcome==='success'`, a single clause with
    // no null case): the wireframe's mock data has no concept of a fast-path
    // (photo-only) meeting, which structurally never has an outcome
    // (Batch 8's flow:'full'|'visit' union). Applying the wireframe's clause
    // literally would mark every New/Existing visit as "not done" always —
    // the common case, not an edge case. Extension (not a wireframe match):
    // null outcome (fast-path) counts as done; every non-null outcome still
    // requires the literal 'Successful' match.
    const done = meeting.outcome ? meeting.outcome === 'Successful' : true;
    items.push({
      key: meeting.id,
      title: `Meeting: ${new Date(meeting.logged_at).toLocaleDateString()} · ${outcomeLabel}`,
      detail: [meeting.agendas.join(', '), formatMeetingLocation(meeting)].filter(Boolean).join(' · '),
      done,
      meeting,
    });
  });

  const status = getClientStatus(client);
  if (status === 'in_progress' || status === 'new' || status === 'existing') {
    items.push({
      key: 'moved-in-progress',
      title: 'Moved to In Progress',
      detail: 'Successful Prospect meeting had at least one selected agenda.',
      done: true,
    });
  }
  if (status === 'new' || status === 'existing') {
    items.push({
      key: 'moved-new',
      title: 'Moved to New',
      detail: 'PO evidence was accepted before promotion.',
      done: true,
    });
  }
  if (status === 'existing') {
    items.push({
      key: 'existing',
      title: 'Existing client',
      detail: 'Client is now in regular service and relationship activity.',
      done: true,
    });
  }

  return items;
}

/**
 * Read-only "Activities & history" screen (2026-08-04 handoff) — Client
 * Detail's own embedded Meeting history section and its action buttons
 * (Edit Client, Create Meeting, Complete Info, office-map, claim,
 * reassignment, approval actions) are untouched; this is a separate,
 * additional screen with no write/action controls of any kind.
 */
export default function ClientJourneyScreen() {
  const insets = useSafeAreaInsets();
  const BIZLINK_COLORS = useBizlinkColors();
  const { clientId, from } = useLocalSearchParams<{ clientId: string; from?: string }>();
  const [client, setClient] = useState<Client | null>(null);
  const [clientLoading, setClientLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { meetings, loading: meetingsLoading } = useMeetings(clientId);

  const loadClient = useCallback(async () => {
    if (!clientId) {
      setError('Client not found.');
      setClientLoading(false);
      return;
    }
    try {
      const found = await getClientById(clientId);
      if (!found) {
        setError('Client not found.');
      } else {
        setClient(found);
        setError(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load client.');
    } finally {
      setClientLoading(false);
    }
  }, [clientId]);

  useEffect(() => {
    loadClient();
  }, [loadClient]);

  useFocusEffect(
    useCallback(() => {
      loadClient();
    }, [loadClient])
  );

  const loading = clientLoading || meetingsLoading;
  const fallbackHref = from ? (from as Href) : undefined;

  if (loading) {
    return (
      <YStack flex={1} backgroundColor={BIZLINK_COLORS.canvas} paddingTop={insets.top}>
        <BizTopBar title="Client journey" fallbackHref={fallbackHref} />
        <YStack flex={1} justifyContent="center" alignItems="center">
          <Spinner size="large" color={BIZLINK_COLORS.brand} />
        </YStack>
      </YStack>
    );
  }

  if (error || !client) {
    return (
      <YStack flex={1} backgroundColor={BIZLINK_COLORS.canvas} paddingTop={insets.top}>
        <BizTopBar title="Client journey" fallbackHref={fallbackHref} />
        <YStack flex={1} justifyContent="center" alignItems="center" padding="$6">
          <Text fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.text}>{error ?? 'Client not found.'}</Text>
        </YStack>
      </YStack>
    );
  }

  const status = getClientStatus(client);
  const progress = getClientJourneyProgress(client, meetings);
  const items = buildJourneyItems(client, meetings);

  return (
    <YStack flex={1} backgroundColor={BIZLINK_COLORS.canvas} paddingTop={insets.top}>
      <BizTopBar title="Client journey" fallbackHref={fallbackHref} />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}>
        <SelectedClientCard clientName={client.company_name} status={status} progress={progress} />

        <BizSectionHeader title="Activities & history" />

        {meetings.length === 0 ? (
          <Text fontSize={12.5} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted} marginBottom="$2">
            Wala pang meetings sa client na ito.
          </Text>
        ) : null}

        <YStack gap="$3">
          {items.map((item) => {
            const outcomeStyle = item.meeting?.outcome ? OUTCOME_BADGE_STYLES[item.meeting.outcome] : null;
            return (
              <XStack key={item.key} gap="$3" alignItems="flex-start">
                <YStack
                  width={26}
                  height={26}
                  borderRadius={13}
                  alignItems="center"
                  justifyContent="center"
                  backgroundColor={item.done ? BIZLINK_COLORS.brand : BIZLINK_COLORS.soft}
                  flexShrink={0}
                  marginTop={2}
                >
                  {item.done ? (
                    <Check size={13} color={BIZLINK_COLORS.card} strokeWidth={2} />
                  ) : (
                    <Circle size={13} color={BIZLINK_COLORS.muted} strokeWidth={1.75} />
                  )}
                </YStack>
                <YStack flex={1} gap="$1">
                  <Text fontFamily={BIZLINK_FONTS.semibold} fontSize={13.5} color={BIZLINK_COLORS.text}>
                    {item.title}
                  </Text>
                  {item.detail ? (
                    <Text fontSize={12} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted} lineHeight={17}>
                      {item.detail}
                    </Text>
                  ) : null}
                  {item.meeting ? (
                    <XStack gap="$1.5" flexWrap="wrap" marginTop="$0.5" alignItems="center">
                      {outcomeStyle && item.meeting.outcome ? (
                        <StatusBadge label={item.meeting.outcome} {...outcomeStyle} />
                      ) : null}
                      {item.meeting.sync_status ? <SyncBadge status={item.meeting.sync_status as OutboxStatus} /> : null}
                    </XStack>
                  ) : null}
                </YStack>
              </XStack>
            );
          })}
        </YStack>
      </ScrollView>
    </YStack>
  );
}
