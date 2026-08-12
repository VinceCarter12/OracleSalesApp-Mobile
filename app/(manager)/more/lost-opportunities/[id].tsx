import type { ReactNode } from 'react';
import { ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Building2, CalendarX, CircleAlert, Clock3, Map, MapPin, User } from 'lucide-react-native';
import { Spinner, Text, XStack, YStack } from 'tamagui';
import { BIZLINK_COLORS, BIZLINK_FONTS } from '../../../../lib/theme';
import { useManagerLostOpportunityDetail } from '../../../../lib/use-manager-lost-opportunities';
import { BizTopBar } from '../../../../components/bizlink/BizTopBar';
import { BizCard } from '../../../../components/bizlink/BizCard';
import { BizSectionHeader } from '../../../../components/bizlink/BizSectionHeader';
import { BizButton } from '../../../../components/bizlink/BizButton';
import { StatusBadge } from '../../../../components/ui/StatusBadge';

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function DoneIcon({ children }: { children: ReactNode }) {
  return (
    <YStack width={24} height={24} borderRadius={12} backgroundColor={BIZLINK_COLORS.brand} alignItems="center" justifyContent="center">
      {children}
    </YStack>
  );
}

/**
 * Wireframe `s-lost-detail` (Wireframe-Manager-BizLink.html ~line 776,
 * `openLostOpportunity()` ~line 1843): lost date + reassignable date +
 * reason, client contact/address/office-pin, last activity, then the
 * read-only footer note "Manager view only. Sales/RSR claim action is not
 * available here." — no claim button, no reassignment control, matching
 * `canClaimLostOpportunity('sales_manager')` already returning false. This
 * screen never renders any claim affordance at all for this role.
 */
export default function ManagerLostOpportunityDetailScreen() {
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { item, loading, error, reload } = useManagerLostOpportunityDetail(id);

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

  if (!item) {
    return (
      <YStack flex={1} backgroundColor={BIZLINK_COLORS.canvas} paddingTop={insets.top}>
        <BizTopBar title="Opportunity detail" fallbackHref="/(manager)/more/lost-opportunities/index" />
        <YStack flex={1} justifyContent="center" alignItems="center" paddingHorizontal="$5">
          <Text fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted} textAlign="center">
            This opportunity is no longer available.
          </Text>
        </YStack>
      </YStack>
    );
  }

  return (
    <YStack flex={1} backgroundColor={BIZLINK_COLORS.canvas} paddingTop={insets.top}>
      <BizTopBar title="Opportunity detail" fallbackHref="/(manager)/more/lost-opportunities/index" />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32 }}>
        <BizCard gap="$1.5">
          <XStack alignItems="flex-start" justifyContent="space-between" gap="$2">
            <YStack gap="$0.5" flex={1}>
              <Text fontFamily={BIZLINK_FONTS.semibold} fontSize={17} color={BIZLINK_COLORS.text}>
                {item.companyName}
              </Text>
              <Text fontSize={12.5} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted}>
                {[item.city, item.channel].filter(Boolean).join(' · ') || 'No location on file'}
              </Text>
            </YStack>
            <StatusBadge label="Inactive" background={BIZLINK_COLORS.soft} color={BIZLINK_COLORS.muted} />
          </XStack>
        </BizCard>

        <BizSectionHeader title="Lost opportunity" />
        <BizCard gap="$2.5">
          <XStack alignItems="center" gap="$2.5">
            <DoneIcon><CalendarX size={15} color="#FFFFFF" strokeWidth={1.75} /></DoneIcon>
            <Text fontSize={13} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.text}>
              Lost date: {formatDate(item.lostAt)}
            </Text>
          </XStack>
          <XStack alignItems="center" gap="$2.5">
            <DoneIcon><Clock3 size={15} color="#FFFFFF" strokeWidth={1.75} /></DoneIcon>
            <Text fontSize={13} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.text}>
              Reassignable: {formatDate(item.reassignableAt)}
            </Text>
          </XStack>
          <XStack alignItems="center" gap="$2.5">
            <DoneIcon><CircleAlert size={15} color="#FFFFFF" strokeWidth={1.75} /></DoneIcon>
            <Text fontSize={13} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.text}>
              Reason: {item.reason ?? 'Not recorded'}
            </Text>
          </XStack>
        </BizCard>

        <BizSectionHeader title="Client information" />
        <BizCard gap="$2.5">
          <XStack alignItems="center" gap="$2.5">
            <DoneIcon><User size={15} color="#FFFFFF" strokeWidth={1.75} /></DoneIcon>
            <Text fontSize={13} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.text}>
              Contact: {item.contactPerson ?? '—'}{item.contactPosition ? ` · ${item.contactPosition}` : ''}
            </Text>
          </XStack>
          <XStack alignItems="center" gap="$2.5">
            <DoneIcon><Building2 size={15} color="#FFFFFF" strokeWidth={1.75} /></DoneIcon>
            <Text fontSize={13} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.text}>
              Address: {item.officeAddress ?? '—'}
            </Text>
          </XStack>
          <XStack alignItems="center" gap="$2.5">
            <DoneIcon><MapPin size={15} color="#FFFFFF" strokeWidth={1.75} /></DoneIcon>
            <Text fontSize={13} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.text}>
              Office: {item.officeLat != null && item.officeLng != null ? `${item.officeLat}, ${item.officeLng}` : '—'}
            </Text>
          </XStack>
        </BizCard>

        {item.officeLat != null && item.officeLng != null ? (
          <BizCard
            onPress={() =>
              router.push({
                pathname: '/(manager)/more/office-map/[id]',
                params: {
                  id: item.id,
                  companyName: item.companyName,
                  lat: String(item.officeLat),
                  lng: String(item.officeLng),
                  verified: item.officePinVerified ? '1' : '0',
                  fallback: '/(manager)/more/lost-opportunities/index',
                },
              })
            }
            pressStyle={{ opacity: 0.85 }}
            marginTop="$3"
            gap="$1"
          >
            <XStack alignItems="center" gap="$2.5">
              <YStack width={36} height={36} borderRadius={18} backgroundColor={BIZLINK_COLORS.soft} alignItems="center" justifyContent="center">
                <Map size={16} color={BIZLINK_COLORS.navy} strokeWidth={1.75} />
              </YStack>
              <YStack flex={1}>
                <Text fontFamily={BIZLINK_FONTS.semibold} fontSize={13.5} color={BIZLINK_COLORS.text}>
                  View permanent office location
                </Text>
                <Text fontSize={11.5} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted}>
                  {item.officeLat}, {item.officeLng} · not meeting GPS
                </Text>
              </YStack>
              <MapPin size={16} color={BIZLINK_COLORS.muted} strokeWidth={1.75} />
            </XStack>
          </BizCard>
        ) : null}

        <BizSectionHeader title="Last activity" />
        <BizCard gap="$1.5">
          <Text fontFamily={BIZLINK_FONTS.semibold} fontSize={13} color={BIZLINK_COLORS.text}>
            {formatDate(item.lastMeetingAt)}
          </Text>
          <Text fontSize={13} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted} lineHeight={18}>
            {item.lastMeetingSummary ?? 'No meeting recorded.'}
          </Text>
        </BizCard>

        <Text fontSize={11.5} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted} marginTop="$4" textAlign="center">
          Manager view only. Sales/RSR claim action is not available here.
        </Text>
      </ScrollView>
    </YStack>
  );
}
