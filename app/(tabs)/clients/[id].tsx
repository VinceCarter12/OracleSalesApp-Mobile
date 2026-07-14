import { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { Camera, Check, Pencil } from 'lucide-react-native';
import { Spinner, Text, View, XStack, YStack } from 'tamagui';
import { supabase } from '../../../lib/supabase';
import { COLORS, OUTCOME_BADGE_STYLES } from '../../../lib/theme';
import { CLIENT_STATUS_BADGES, getClientStatus } from '../../../lib/client-status';
import { getClientProgressBreakdown, getInfoChecklist } from '../../../lib/client-progress';
import { useMeetings } from '../../../lib/useMeetings';
import { TopBar } from '../../../components/ui/TopBar';
import { LockButton } from '../../../components/security/LockButton';
import { Card } from '../../../components/ui/Card';
import { ProgressRing } from '../../../components/ui/ProgressRing';
import { StatusBadge } from '../../../components/ui/StatusBadge';
import { SectionHeader } from '../../../components/ui/SectionHeader';
import { DuoButton } from '../../../components/ui/DuoButton';
import type { Client } from '../../../types';

export default function ClientDetailScreen() {
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [client, setClient] = useState<Client | null>(null);
  const [loading, setLoading] = useState(true);
  const { meetings } = useMeetings(id);

  const loadClient = useCallback(() => {
    if (!id) return;
    supabase
      .from('clients')
      .select('*')
      .eq('id', id)
      .single()
      .then(({ data, error }) => {
        if (error) Alert.alert('Error', error.message);
        else setClient(data);
        setLoading(false);
      });
  }, [id]);

  useEffect(loadClient, [loadClient]);
  // Refresh after Complete Info saves and navigates back.
  useFocusEffect(useCallback(() => loadClient(), [loadClient]));

  if (loading) {
    return (
      <YStack flex={1} justifyContent="center" alignItems="center" backgroundColor={COLORS.snow}>
        <Spinner size="large" color={COLORS.feather} />
      </YStack>
    );
  }

  if (!client) {
    return (
      <YStack flex={1} justifyContent="center" alignItems="center" padding="$6" backgroundColor={COLORS.snow}>
        <Text>Client not found.</Text>
      </YStack>
    );
  }

  const status = getClientStatus(client);
  const badge = CLIENT_STATUS_BADGES[status];
  const checklist = getInfoChecklist(client);
  const { presented, total } = getClientProgressBreakdown(client, meetings);
  const progress = total;

  return (
    <YStack flex={1} backgroundColor={COLORS.snow} paddingTop={insets.top}>
      <TopBar title="Client" right={<LockButton />} />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}>
        <Card flexDirection="row" alignItems="center" gap="$3.5">
          <ProgressRing percent={progress} />
          <YStack flex={1} gap="$1.5">
            <Text fontWeight="800" fontSize={17} color={COLORS.eel} lineHeight={20}>
              {client.company_name}
            </Text>
            <XStack gap="$1.5">
              <StatusBadge {...badge} />
              {client.sales_channel ? (
                <StatusBadge label={client.sales_channel} background={COLORS.purpleSoft} color={COLORS.purple} />
              ) : null}
            </XStack>
            {/* States plainly that the ring is a Record Meeting -> Agenda
                outcome, not an info-completion score (B-001, corrected
                2026-07-11 — info completion has zero weight here). */}
            <StatusBadge
              label={presented ? 'Product presentation done (Record Meeting)' : 'Walang product presentation pa — 0%'}
              background={presented ? COLORS.greenTint : COLORS.polar}
              color={presented ? COLORS.ledgeGreen : COLORS.hare}
            />
          </YStack>
        </Card>

        <SectionHeader
          title="Info completion"
          helper={status === 'prospect' ? '1-month rule' : undefined}
        />
        <Text fontSize={12} fontWeight="600" color={COLORS.hare} marginTop={-6} marginBottom="$2">
          Para lang ito sa 1-month data-quality rule — hiwalay na sa progress % sa taas (B-001).
        </Text>
        <Card>
          {checklist.map((item, index) => (
            <XStack
              key={item.key}
              alignItems="center"
              gap="$2.5"
              paddingVertical={9}
              borderBottomWidth={index === checklist.length - 1 ? 0 : 2}
              borderBottomColor={COLORS.polar}
            >
              <View
                width={22}
                height={22}
                borderRadius={11}
                backgroundColor={item.done ? COLORS.feather : COLORS.swan}
                alignItems="center"
                justifyContent="center"
              >
                {item.done ? <Check size={12} color={COLORS.snow} /> : null}
              </View>
              <Text
                fontSize={13.5}
                fontWeight="700"
                color={item.done ? COLORS.eel : COLORS.hare}
              >
                {item.label}
              </Text>
            </XStack>
          ))}
        </Card>

        <YStack marginTop="$3.5">
          <DuoButton
            label="Complete / Edit Info"
            variant="white"
            icon={<Pencil size={15} color={COLORS.eel} />}
            onPress={() => router.push(`/(tabs)/clients/complete?clientId=${client.id}`)}
          />
        </YStack>

        <SectionHeader title="Meeting history" />
        {meetings.length === 0 ? (
          <Text fontSize={13} fontWeight="600" color={COLORS.hare}>
            Wala pang meetings sa client na ito.
          </Text>
        ) : (
          meetings.map((meeting) => {
            const outcomeStyle = meeting.outcome ? OUTCOME_BADGE_STYLES[meeting.outcome] : null;
            return (
              <Pressable key={meeting.id} onPress={() => router.push(`/(tabs)/meetings/${meeting.id}`)}>
                <XStack
                  alignItems="center"
                  gap="$3"
                  paddingVertical={13}
                  borderBottomWidth={2}
                  borderBottomColor={COLORS.polar}
                >
                  <YStack flex={1} gap="$0.5">
                    <Text fontWeight="800" fontSize={14} color={COLORS.eel}>
                      {new Date(meeting.logged_at).toLocaleDateString()}
                    </Text>
                    <Text fontSize={11.5} fontWeight="600" color={COLORS.hare}>
                      {new Date(meeting.logged_at).toLocaleTimeString()}
                    </Text>
                  </YStack>
                  {outcomeStyle && meeting.outcome ? (
                    <StatusBadge label={meeting.outcome} {...outcomeStyle} />
                  ) : (
                    <StatusBadge label="Photo visit" background={COLORS.greenTint} color={COLORS.ledgeGreen} />
                  )}
                </XStack>
              </Pressable>
            );
          })
        )}

        <YStack marginTop="$4">
          <DuoButton
            label="Record Meeting Here"
            icon={<Camera size={15} color={COLORS.snow} />}
            onPress={() =>
              router.push(
                status === 'existing'
                  ? `/(tabs)/meetings/record-visit?clientId=${client.id}`
                  : `/(tabs)/meetings/record?clientId=${client.id}`
              )
            }
          />
        </YStack>
      </ScrollView>
    </YStack>
  );
}
