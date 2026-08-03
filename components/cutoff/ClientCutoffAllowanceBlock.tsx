import { useEffect, useState } from 'react';
import { CalendarRange, TriangleAlert } from 'lucide-react-native';
import { Text, XStack, YStack } from 'tamagui';
import { useBizlinkColors, BIZLINK_FONTS } from '../../lib/theme';
import { getCutoffClientAllowance, type CutoffClientAllowanceData } from '../../lib/cutoff-quota-service';
import { useCutoffQuotaFlag } from '../../lib/use-cutoff-quota-flag';
import { isFastPathEligible } from '../../lib/client-status';
import type { Client } from '../../types';

interface ClientCutoffAllowanceBlockProps {
  client: Pick<Client, 'id' | 'status'> | null;
  /** Compact = single-line style used on the pre-start Record Meeting screens (W-2/W-5); false = the fuller Client Detail card (W-4/W-6). */
  compact?: boolean;
}

/**
 * W-4 (Client Detail), W-2/W-5 (Record Meeting pre-start allowance line),
 * and the read-only basis for W-6 (Manager Client Detail — same component,
 * Manager screen never passes an edit affordance so it stays read-only by
 * construction). Renders nothing for Prospect/In Progress clients (contract
 * item 3), when the flag is OFF, or when no allowance snapshot exists yet
 * (Batch 7B not landed).
 */
export function ClientCutoffAllowanceBlock({ client, compact }: ClientCutoffAllowanceBlockProps) {
  const BIZLINK_COLORS = useBizlinkColors();
  const flagOn = useCutoffQuotaFlag();
  const [data, setData] = useState<CutoffClientAllowanceData | null>(null);
  const eligible = client ? isFastPathEligible(client) : false;

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!flagOn || !client || !eligible) {
        await Promise.resolve();
        if (!cancelled) setData(null);
        return;
      }
      try {
        const result = await getCutoffClientAllowance(client.id);
        if (!cancelled) setData(result);
      } catch (err) {
        console.error('[ClientCutoffAllowanceBlock] load failed:', err);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [flagOn, client, eligible]);

  if (!flagOn || !eligible || !data || data.cap === null) return null;

  const remaining = Math.max(0, data.cap - data.usedCount);
  const atCap = remaining === 0;

  return (
    <YStack backgroundColor={BIZLINK_COLORS.card} borderRadius={16} padding={14} marginTop={compact ? 12 : 14}>
      <XStack justifyContent="space-between" alignItems="center" gap="$2">
        <XStack alignItems="center" gap="$1.5">
          <CalendarRange size={13} color={BIZLINK_COLORS.text} strokeWidth={1.75} />
          <Text fontSize={12.5} fontFamily={BIZLINK_FONTS.semibold} color={BIZLINK_COLORS.text}>Cutoff allowance</Text>
        </XStack>
        <Text fontSize={11} fontFamily={BIZLINK_FONTS.semibold} color={BIZLINK_COLORS.muted}>
          {data.usedCount} / {data.cap} used
        </Text>
      </XStack>
      <Text fontSize={11} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted} marginTop={5}>
        {data.periodLabel}
      </Text>
      {atCap ? (
        <XStack alignItems="center" gap="$1.5" backgroundColor="#FFF1D7" borderRadius={12} padding={10} marginTop={8}>
          <TriangleAlert size={14} color="#7A4A00" strokeWidth={1.75} />
          <Text fontSize={11} fontFamily={BIZLINK_FONTS.medium} color="#7A4A00" flex={1}>
            At cap — you may still record. Server confirmation will classify any additional meeting.
          </Text>
        </XStack>
      ) : (
        <Text fontSize={11} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted} marginTop={5}>
          {remaining} meeting{remaining === 1 ? '' : 's'} remaining for this client.
        </Text>
      )}
    </YStack>
  );
}
