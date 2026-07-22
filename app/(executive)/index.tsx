import { Pressable, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Bell, Building2, Map, RefreshCw, Users } from 'lucide-react-native';
import { Spinner, Text, XStack, YStack } from 'tamagui';
import { BIZLINK_COLORS, BIZLINK_FONTS } from '../../lib/theme';
import { useExecutiveOverview } from '../../lib/use-executive-overview';
import { avatarPaletteFor } from '../../lib/avatar-palette';
import { Avatar } from '../../components/ui/Avatar';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { BizStatCard } from '../../components/bizlink/BizStatCard';
import { BizHeroCard } from '../../components/bizlink/BizHeroCard';
import { BizSectionHeader } from '../../components/bizlink/BizSectionHeader';
import { BizQuickAction } from '../../components/bizlink/BizQuickAction';
import { BizButton } from '../../components/bizlink/BizButton';

/**
 * Wireframe x-home — company-wide metrics across BOTH tracks (Sales + RSR),
 * view-only. No SyncStatusChip/sheet here — Executive is read-only across
 * every screen (no create/edit/approve action, no local outbox), so an
 * outbox-style sync chip has nothing real to report — see wireframe's own
 * code comment on `#x-home`. A passive "Data as of ..." freshness line
 * answers the question that actually applies to a read-only aggregate view.
 *
 * B-054 Phase 2 (2026-07-21): real company-wide data via
 * lib/use-executive-overview.ts, replacing the EXEC_* mock reductions.
 */
export default function ExecutiveHomeScreen() {
  const insets = useSafeAreaInsets();
  const { overview, loading, error, reload } = useExecutiveOverview();
  const freshnessTime = new Date().toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit' });

  if (loading || !overview) {
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

  const { totals, managers } = overview;
  const totalMeetings = managers.reduce((sum, m) => sum + m.meetings, 0);

  return (
    <YStack flex={1} backgroundColor={BIZLINK_COLORS.canvas} paddingTop={insets.top}>
      <XStack alignItems="center" gap="$3" paddingHorizontal="$4" paddingTop="$2.5" paddingBottom="$1.5">
        <Avatar initials="EX" background={BIZLINK_COLORS.soft} color={BIZLINK_COLORS.navy} />
        <YStack gap="$1">
          <Text fontFamily={BIZLINK_FONTS.semibold} fontSize={15.5} color={BIZLINK_COLORS.text}>
            Executive Dashboard
          </Text>
          <StatusBadge label="Executive" background={BIZLINK_COLORS.soft} color={BIZLINK_COLORS.navy} />
        </YStack>
        <Pressable onPress={() => router.push('/(executive)/more/approvals-log')} style={{ marginLeft: 'auto' }} hitSlop={6}>
          <YStack width={44} height={44} borderRadius={22} backgroundColor={BIZLINK_COLORS.card} alignItems="center" justifyContent="center" position="relative">
            <Bell size={17} color={BIZLINK_COLORS.text} strokeWidth={1.75} />
          </YStack>
        </Pressable>
      </XStack>

      <XStack alignItems="center" gap="$1.5" paddingHorizontal="$4" paddingBottom="$1">
        <RefreshCw size={11} color={BIZLINK_COLORS.muted} strokeWidth={1.75} />
        <Text fontSize={10.5} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted}>
          Data as of {freshnessTime} · updated automatically
        </Text>
      </XStack>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 96 }}>
        <XStack gap={10} marginTop={6}>
          <YStack flex={1}>
            <BizStatCard
              tone="tintA"
              value={totals.prospects}
              label="Total Prospects"
              caption="company-wide"
              onPress={() => router.push('/(executive)/clients')}
            />
          </YStack>
          <YStack flex={1}>
            <BizStatCard
              tone="white"
              value={totals.clients}
              label="Total Clients"
              caption="company-wide"
              onPress={() => router.push('/(executive)/clients')}
            />
          </YStack>
        </XStack>

        <BizHeroCard
          value={totals.meetingsThisMonth}
          unit="meetings"
          label="Company meetings · this month"
          caption={`${totals.successfulThisMonth} successful`}
          onPress={() => router.push('/(executive)/more/reports')}
        />

        <BizSectionHeader title="Quick Actions" />
        <XStack gap="$2.5" flexWrap="wrap">
          <BizQuickAction
            icon={<Users size={20} color={BIZLINK_COLORS.ink} strokeWidth={1.75} />}
            label="Teams"
            onPress={() => router.push('/(executive)/teams')}
          />
          <BizQuickAction
            icon={<Building2 size={20} color={BIZLINK_COLORS.ink} strokeWidth={1.75} />}
            label="Clients"
            onPress={() => router.push('/(executive)/clients')}
          />
          <BizQuickAction
            icon={<Map size={20} color={BIZLINK_COLORS.ink} strokeWidth={1.75} />}
            label="Maps"
            onPress={() => router.push('/(executive)/more/maps')}
          />
          <BizQuickAction
            icon={<Building2 size={20} color={BIZLINK_COLORS.ink} strokeWidth={1.75} />}
            label="Reports"
            onPress={() => router.push('/(executive)/more/reports')}
          />
        </XStack>

        <BizSectionHeader title="Company Overview" actionLabel="Reports" onAction={() => router.push('/(executive)/more/reports')} />
        <XStack gap={10}>
          <YStack flex={1}>
            <BizStatCard
              tone="white"
              value={managers.length}
              label={`Teams / Managers · ${totals.agents} agents total`}
              caption="company-wide"
              onPress={() => router.push('/(executive)/teams')}
            />
          </YStack>
          <YStack flex={1}>
            <BizStatCard
              tone="tintB"
              value={totals.lostCompanyWide}
              label="Lost Opportunities · Company-wide"
              caption="bantayan"
              onPress={() => router.push('/(executive)/more/lost-opportunity')}
            />
          </YStack>
        </XStack>

        <BizSectionHeader title="Teams" actionLabel="Tingnan lahat" onAction={() => router.push('/(executive)/teams')} />
        {managers.map((manager) => {
          const color = avatarPaletteFor(manager.id);
          return (
            <XStack
              key={manager.id}
              alignItems="center"
              gap="$3"
              backgroundColor={BIZLINK_COLORS.card}
              borderRadius={20}
              padding={14}
              marginBottom={10}
              onPress={() => router.push(`/(executive)/teams/${manager.id}`)}
              pressStyle={{ opacity: 0.85 }}
            >
              <Avatar initials={manager.initials} size="sm" background={color.background} color={color.color} />
              <YStack flex={1} gap="$0.5">
                <Text fontFamily={BIZLINK_FONTS.semibold} fontSize={14} color={BIZLINK_COLORS.text}>{manager.name}</Text>
                <Text fontSize={11.5} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted}>
                  {manager.agentCount} agents · {manager.clients} clients
                </Text>
              </YStack>
              <Text color={BIZLINK_COLORS.muted} fontSize={16}>›</Text>
            </XStack>
          );
        })}
      </ScrollView>
    </YStack>
  );
}
