import type { ReactNode } from 'react';
import { ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { BarChart3, Bell, ClipboardCheck, History, Map, RotateCcw, User, Users } from 'lucide-react-native';
import { Text, XStack, YStack } from 'tamagui';
import { useBizlinkColors, BIZLINK_FONTS } from '../../../lib/theme';
import { useSession } from '../../../lib/session-store';
import { canClaimLostOpportunity } from '../../../lib/policies/lost-opportunity-claim-policy';
import { BizMoreTile } from '../../../components/bizlink/BizMoreTile';

/** Wireframe a-more — grid of secondary destinations; lock dots mark gated (sensitive) info. */
export default function MoreScreen() {
  const insets = useSafeAreaInsets();
  const BIZLINK_COLORS = useBizlinkColors();
  const { role } = useSession();
  return (
    <YStack flex={1} backgroundColor={BIZLINK_COLORS.canvas} paddingTop={insets.top}>
      <XStack alignItems="center" paddingHorizontal="$4" paddingTop="$2.5" paddingBottom="$1.5">
        <Text fontSize={26} fontFamily={BIZLINK_FONTS.semibold} color={BIZLINK_COLORS.text}>More</Text>
      </XStack>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 + insets.bottom }}>
        <Text fontSize={13} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted} marginBottom="$3.5">
          Ang sensitibong impormasyon ay nangangailangan ng fingerprint o device lock.
        </Text>
        {/* Wireframe `.moregrid` (2026-08-03 verified): explicit 2-column grid,
            grid-template-columns: repeat(2,1fr), gap: 12px — rowed manually
            (not flexWrap+space-between) so a partial last row aligns to
            column 1 instead of stretching/centering, matching the same
            fixed-gap approach used by the Dashboard Hub's "Iba pang gawain"
            grid. */}
        {(() => {
          const tiles = [
            <BizMoreTile
              key="notifications"
              icon={<Bell size={18} color={BIZLINK_COLORS.ink} strokeWidth={1.75} />}
              title="Notifications"
              subtitle={<Text fontSize={10.5} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted}>Sync alerts, deadline reminders</Text>}
              onPress={() => router.push('/(tabs)/more/notifications')}
            />,
            <BizMoreTile
              key="tag-along"
              icon={<Users size={18} color={BIZLINK_COLORS.ink} strokeWidth={1.75} />}
              title="Tag-Along"
              subtitle={<Text fontSize={10.5} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted}>Hilingin sa manager na sumama</Text>}
              onPress={() => router.push('/(tabs)/more/tag-along')}
            />,
            <BizMoreTile
              key="sync-history"
              icon={<History size={18} color={BIZLINK_COLORS.ink} strokeWidth={1.75} />}
              title="Sync History"
              subtitle={<Text fontSize={10.5} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted}>Ano ang na-sync, kailan</Text>}
              onPress={() => router.push('/(tabs)/more/sync-history')}
            />,
            <BizMoreTile
              key="performance"
              icon={<BarChart3 size={18} color={BIZLINK_COLORS.ink} strokeWidth={1.75} />}
              title="My Performance"
              subtitle={<Text fontSize={10.5} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted}>Sariling stats lang</Text>}
              onPress={() => router.push('/(tabs)/more/reports')}
            />,
            <BizMoreTile
              key="maps"
              icon={<Map size={18} color={BIZLINK_COLORS.ink} strokeWidth={1.75} />}
              title="Maps"
              subtitle={<Text fontSize={10.5} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted}>Read-only office pins</Text>}
              onPress={() => router.push('/(tabs)/more/maps')}
            />,
            <BizMoreTile
              key="my-requests"
              icon={<ClipboardCheck size={18} color={BIZLINK_COLORS.ink} strokeWidth={1.75} />}
              title="My Requests"
              subtitle={<Text fontSize={10.5} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted}>PO, edit, at tag-along status</Text>}
              onPress={() => router.push('/(tabs)/more/my-requests')}
            />,
            ...(canClaimLostOpportunity(role)
              ? [
                  <BizMoreTile
                    key="lost-opportunities"
                    icon={<RotateCcw size={18} color={BIZLINK_COLORS.ink} strokeWidth={1.75} />}
                    title="Lost Opportunities"
                    subtitle={<Text fontSize={10.5} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted}>Claim released prospects</Text>}
                    onPress={() => router.push('/(tabs)/more/lost-opportunities')}
                  />,
                ]
              : []),
            <BizMoreTile
              key="account"
              icon={<User size={18} color={BIZLINK_COLORS.ink} strokeWidth={1.75} />}
              title="Account & Security"
              subtitle={<Text fontSize={10.5} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted}>Profile, device lock, sign out</Text>}
              onPress={() => router.push('/(tabs)/more/account')}
            />,
          ];
          const rows: ReactNode[][] = [];
          for (let i = 0; i < tiles.length; i += 2) rows.push(tiles.slice(i, i + 2));
          return (
            <YStack gap={12}>
              {rows.map((row, index) => (
                <XStack key={index} gap={12} justifyContent="flex-start">
                  {row}
                </XStack>
              ))}
            </YStack>
          );
        })()}
      </ScrollView>
    </YStack>
  );
}
