import { useEffect, useState } from 'react';
import { CircleAlert, Clock, Target } from 'lucide-react-native';
import { Text, View, XStack, YStack } from 'tamagui';
import { useBizlinkColors, BIZLINK_FONTS } from '../../lib/theme';
import { getCutoffQuotaCard, type CutoffQuotaCardData } from '../../lib/cutoff-quota-service';
import { useCutoffQuotaFlag } from '../../lib/use-cutoff-quota-flag';
import type { CutoffQuotaRole } from '../../lib/policies/cutoff-policy';

interface CutoffQuotaCardProps {
  agentId: string | null;
  role: CutoffQuotaRole;
}

/**
 * W-1 (Wireframe-Sales-BizLink.html `#a-quotaWidget`): shared Sales/RSR
 * cutoff/quota card, reusing the RSR widget's visual pattern (ADR-053
 * contract item 6). Renders nothing when the `cutoff_quota_v1` flag is OFF,
 * when there's no signed-in agent, or when the snapshot has no active
 * period/usage row for this role yet (Batch 7B not landed — the snapshot is
 * always empty right now, so this renders the "No quota configured" empty
 * state rather than a broken zero).
 */
export function CutoffQuotaCard({ agentId, role }: CutoffQuotaCardProps) {
  const BIZLINK_COLORS = useBizlinkColors();
  const flagOn = useCutoffQuotaFlag();
  const [data, setData] = useState<CutoffQuotaCardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!flagOn || !agentId) {
        await Promise.resolve();
        if (!cancelled) setLoading(false);
        return;
      }
      try {
        const result = await getCutoffQuotaCard(agentId, role);
        if (!cancelled) setData(result);
      } catch (err) {
        console.error('[CutoffQuotaCard] load failed:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [flagOn, agentId, role]);

  if (!flagOn || loading) return null;

  const unconfigured = !data || data.target === null;
  const remaining = data && data.target !== null ? Math.max(0, data.target - data.confirmedCount) : 0;
  const pct = data && data.target !== null && data.target > 0 ? Math.min(100, Math.round((data.confirmedCount / data.target) * 100)) : 0;

  return (
    <YStack backgroundColor={BIZLINK_COLORS.card} borderRadius={24} padding={18} marginTop={16}>
      {unconfigured ? (
        <YStack gap="$1.5">
          <XStack alignItems="center" gap="$1.5">
            <CircleAlert size={14} color={BIZLINK_COLORS.text} strokeWidth={1.75} />
            <Text fontSize={12.5} fontFamily={BIZLINK_FONTS.semibold} color={BIZLINK_COLORS.text}>No quota configured</Text>
          </XStack>
          <Text fontSize={11} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted}>
            Wala pang active cutoff target na na-sync para sa role mo. Hindi gagamit ng fallback na number ang app.
          </Text>
        </YStack>
      ) : (
        <YStack gap="$1.5">
          <XStack justifyContent="space-between" alignItems="center">
            <XStack alignItems="center" gap="$1.5">
              <Target size={14} color={BIZLINK_COLORS.text} strokeWidth={1.75} />
              <Text fontSize={12.5} fontFamily={BIZLINK_FONTS.semibold} color={BIZLINK_COLORS.text}>Cutoff quota</Text>
            </XStack>
            <Text fontSize={12} fontFamily={BIZLINK_FONTS.semibold} color={BIZLINK_COLORS.muted}>
              {data.confirmedCount} / {data.target} confirmed
            </Text>
          </XStack>
          <Text fontSize={11} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted}>
            Active cutoff: {data.periodLabel}
          </Text>
          <View height={8} borderRadius={99} backgroundColor={BIZLINK_COLORS.soft} overflow="hidden">
            <View height="100%" borderRadius={99} backgroundColor={BIZLINK_COLORS.brand} width={`${pct}%`} />
          </View>
          <XStack alignItems="center" justifyContent="space-between" marginTop="$1">
            <Text fontSize={11} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted}>
              {remaining} remaining to target
            </Text>
            <XStack alignItems="center" gap="$1" backgroundColor={BIZLINK_COLORS.tintA} borderRadius={999} paddingHorizontal={10} paddingVertical={4}>
              <Clock size={11} color={BIZLINK_COLORS.ink} strokeWidth={1.75} />
              <Text fontSize={10.5} fontFamily={BIZLINK_FONTS.semibold} color={BIZLINK_COLORS.ink}>{data.pendingCount} pending</Text>
            </XStack>
          </XStack>
        </YStack>
      )}
    </YStack>
  );
}
