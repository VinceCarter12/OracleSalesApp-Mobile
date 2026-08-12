import { useCallback, useState } from 'react';
import { ScrollView } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Spinner, Text, YStack } from 'tamagui';
import { BizTopBar } from '../../components/bizlink/BizTopBar';
import { useBizlinkColors, BIZLINK_FONTS } from '../../lib/theme';
import { useSession } from '../../lib/session-store';
import { getMyCompanionRequests, type MyCompanionRequest } from '../../lib/tag-along-service';

export default function ManagerTagAlongScreen() {
  const colors = useBizlinkColors();
  const insets = useSafeAreaInsets();
  const { profileId } = useSession();
  const [rows, setRows] = useState<MyCompanionRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(() => { if (!profileId) return; setLoading(true); setError(null); getMyCompanionRequests(profileId).then(setRows).catch(() => setError('Could not load Tag-Along requests.')).finally(() => setLoading(false)); }, [profileId]);
  useFocusEffect(useCallback(() => { load(); }, [load]));
  return <YStack flex={1} backgroundColor={colors.canvas} paddingTop={insets.top}><BizTopBar title="Tag-Along" fallbackHref="/(manager)/more/notifications" /><ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 24 }}>{loading ? <YStack alignItems="center" padding="$8"><Spinner size="large" color={colors.brand} /></YStack> : error ? <YStack alignItems="center" padding="$8" gap="$2"><Text color={colors.red} fontFamily={BIZLINK_FONTS.medium}>{error}</Text><Text onPress={load} color={colors.brand} fontFamily={BIZLINK_FONTS.semibold}>Retry</Text></YStack> : rows.length === 0 ? <Text textAlign="center" color={colors.muted} fontFamily={BIZLINK_FONTS.medium} padding="$8">Wala pang Tag-Along request.</Text> : rows.map((row) => <YStack key={row.id} backgroundColor={colors.card} borderRadius={16} padding={16} marginBottom={10} gap="$1"><Text fontFamily={BIZLINK_FONTS.semibold} color={colors.text}>{row.clientName ?? 'Client unavailable'}</Text><Text fontFamily={BIZLINK_FONTS.medium} color={colors.muted}>{row.inviteeName ?? 'Teammate'} · {row.status}</Text></YStack>)}</ScrollView></YStack>;
}
