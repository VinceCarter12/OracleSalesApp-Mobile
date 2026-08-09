import { useCallback, useEffect, useState } from 'react';
import { ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { Building2, CalendarX, CircleAlert, Handshake, Map, MapPin, User } from 'lucide-react-native';
import { Spinner, Text, XStack, YStack } from 'tamagui';
import { BIZLINK_COLORS, BIZLINK_FONTS } from '../../../../lib/theme';
import { useLostOpportunityDetail } from '../../../../lib/use-lost-opportunities';
import { useSession } from '../../../../lib/session-store';
import { useClientFlowRoutes } from '../../../../lib/use-role-routes';
import { isLikelyOnline } from '../../../../lib/sync/connectivity';
import { runSync } from '../../../../lib/sync-engine';
import { claimLostOpportunity } from '../../../../lib/lost-opportunity-claim-service';
import { canClaimLostOpportunity, isClaimSuccess, mapLostOpportunityClaimCode } from '../../../../lib/policies/lost-opportunity-claim-policy';
import { showToast } from '../../../../lib/toast';
import { BizTopBar } from '../../../../components/bizlink/BizTopBar';
import { BizCard } from '../../../../components/bizlink/BizCard';
import { BizSectionHeader } from '../../../../components/bizlink/BizSectionHeader';
import { BizButton } from '../../../../components/bizlink/BizButton';

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

/**
 * Wireframe `a-lostoppdetail` (Wireframe-Sales-BizLink.html ~line 1003,
 * `aOpenLostOpportunity()`/`aClaimLostOpportunity()` ~line 1372-1380): lost
 * date + reason and safe client profile fields, then a "Claim this
 * opportunity" button. Prior activity/history is intentionally not shown to
 * Sales/RSR. Claim is online-only (same pattern as
 * `app/(manager)/approvals/[id].tsx`'s Approve/Reject) — the server RPC is
 * the single source of truth (former-owner exclusion, cooldown, role,
 * already-claimed), this screen only relays its response code and never
 * shows an optimistic success.
 */
export default function LostOpportunityDetailScreen() {
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { role, profileId, teamId } = useSession();
  const routes = useClientFlowRoutes();
  const { item, loading, error, reload } = useLostOpportunityDetail(id);

  const [online, setOnline] = useState(true);
  const [claiming, setClaiming] = useState(false);
  const [claimError, setClaimError] = useState<string | null>(null);

  const checkOnline = useCallback(() => {
    isLikelyOnline().then(setOnline);
  }, []);

  useEffect(() => { checkOnline(); }, [checkOnline]);
  useFocusEffect(useCallback(() => { checkOnline(); }, [checkOnline]));

  async function handleClaim(): Promise<void> {
    if (!item) return;
    setClaiming(true);
    setClaimError(null);
    try {
      const { code, clientId } = await claimLostOpportunity(item.id);
      if (isClaimSuccess(code)) {
        showToast(mapLostOpportunityClaimCode(code));
        // The claim RPC is a live-only write with no outbox row — force a
        // pull-down before navigating so the newly-reassigned client
        // actually exists in local SQLite (the client detail screen's
        // primary read path, ADR-001/T-003) instead of showing "not found."
        if (profileId) {
          await runSync(profileId, teamId);
        }
        // The replacement RPC returns a redacted fresh-prospect id. Never
        // route back to the historical lost-client id (legacy RPCs are
        // rejected by claimLostOpportunity before this point).
        router.replace(routes.clientDetail(clientId ?? item.id));
        return;
      }
      // Any other code: never optimistic — show the mapped message and
      // refetch so a stale/claimed-elsewhere row never lingers as claimable.
      showToast(mapLostOpportunityClaimCode(code));
      await reload();
    } catch (err) {
      setClaimError(err instanceof Error ? err.message : 'Hindi na-proseso ang claim. Subukan ulit.');
    } finally {
      setClaiming(false);
    }
  }

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
        <BizTopBar title="Opportunity detail" fallbackHref="/(tabs)/more/lost-opportunities" />
        <YStack flex={1} justifyContent="center" alignItems="center" paddingHorizontal="$5">
          <Text fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted} textAlign="center">
            Hindi na available ang opportunity na ito.
          </Text>
        </YStack>
      </YStack>
    );
  }

  const canClaim = canClaimLostOpportunity(role);

  return (
    <YStack flex={1} backgroundColor={BIZLINK_COLORS.canvas} paddingTop={insets.top}>
      <BizTopBar title="Opportunity detail" fallbackHref="/(tabs)/more/lost-opportunities" />
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
          </XStack>
        </BizCard>

        <BizSectionHeader title="Lost opportunity" />
        <BizCard gap="$2.5">
          <XStack alignItems="center" gap="$2.5">
            <CalendarX size={16} color={BIZLINK_COLORS.navy} strokeWidth={1.75} />
            <Text fontSize={13} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.text}>
              Lost date: {formatDate(item.lostAt)}
            </Text>
          </XStack>
          <XStack alignItems="center" gap="$2.5">
            <CircleAlert size={16} color={BIZLINK_COLORS.navy} strokeWidth={1.75} />
            <Text fontSize={13} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.text}>
              Reason: {item.reason ?? 'Not recorded'}
            </Text>
          </XStack>
        </BizCard>

        <BizSectionHeader title="Client information" />
        <BizCard gap="$2.5">
          <XStack alignItems="center" gap="$2.5"><User size={16} color={BIZLINK_COLORS.navy} strokeWidth={1.75} /><Text fontSize={13} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.text}>Contact: {item.contactPerson ?? '—'}{item.contactPosition ? ` · ${item.contactPosition}` : ''}</Text></XStack>
          <XStack alignItems="center" gap="$2.5"><Building2 size={16} color={BIZLINK_COLORS.navy} strokeWidth={1.75} /><Text fontSize={13} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.text}>Address: {item.officeAddress ?? '—'}</Text></XStack>
        </BizCard>
        {item.officeLat != null && item.officeLng != null ? <BizCard gap="$1" marginTop="$3"><XStack alignItems="center" gap="$2.5"><Map size={16} color={BIZLINK_COLORS.navy} strokeWidth={1.75} /><Text fontSize={13} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.text}>Office pin: {item.officeLat}, {item.officeLng}</Text><MapPin size={16} color={BIZLINK_COLORS.muted} strokeWidth={1.75} /></XStack></BizCard> : null}

        {canClaim ? (
          <>
            {claimError ? (
              <Text fontSize={12.5} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.red} marginTop="$3" textAlign="center">
                {claimError}
              </Text>
            ) : null}
            {!online ? (
              <Text fontSize={12} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted} marginTop="$3" textAlign="center">
                Online-only ang claim. Gagana kapag may signal.
              </Text>
            ) : null}
            <BizButton
              label="Claim this opportunity"
              icon={<Handshake size={16} color="#FFFFFF" strokeWidth={1.75} />}
              disabled={!online || claiming}
              onPress={handleClaim}
              style={{ marginTop: 16 }}
            />
            <Text fontSize={11.5} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted} marginTop="$2" textAlign="center">
              First successful server claim wins. Your former owner cannot reclaim it.
            </Text>
          </>
        ) : null}
      </ScrollView>
    </YStack>
  );
}
