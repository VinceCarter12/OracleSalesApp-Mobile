import { useCallback, useState } from 'react';
import { ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { Smartphone } from 'lucide-react-native';
import { Spinner, Text, View, YStack } from 'tamagui';
import { useBizlinkColors, BIZLINK_FONTS } from '../../../../lib/theme';
import { getSyncHistory, type SyncHistoryEntry } from '../../../../lib/sync-history';
import { BizTopBar } from '../../../../components/bizlink/BizTopBar';
import { BizCard } from '../../../../components/bizlink/BizCard';

/**
 * Wireframe sync record detail screen (Screenshot 2) — shows full record
 * information including type, local record ID, included fields, result,
 * completed timestamp, and device-scoped history notice.
 */
export default function SyncRecordDetailScreen() {
  const insets = useSafeAreaInsets();
  const BIZLINK_COLORS = useBizlinkColors();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [entry, setEntry] = useState<SyncHistoryEntry | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const entries = await getSyncHistory(200); // Load more to find specific entry
      const found = entries.find((e) => e.id === id);
      setEntry(found ?? null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (loading) {
    return (
      <YStack flex={1} backgroundColor={BIZLINK_COLORS.canvas} paddingTop={insets.top} justifyContent="center" alignItems="center">
        <Spinner size="large" color={BIZLINK_COLORS.brand} />
      </YStack>
    );
  }

  if (!entry) {
    return (
      <YStack flex={1} backgroundColor={BIZLINK_COLORS.canvas} paddingTop={insets.top}>
        <BizTopBar title="Sync Record" fallbackHref="/(tabs)/more/sync-history" />
        <YStack flex={1} justifyContent="center" alignItems="center" paddingHorizontal="$5">
          <Text fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted} textAlign="center">
            Hindi makita ang sync record na ito.
          </Text>
        </YStack>
      </YStack>
    );
  }

  // Determine record type label
  const getRecordType = () => {
    if (entry.tableName === 'clients') return 'Client';
    if (entry.tableName === 'meetings') return 'Meeting';
    return entry.tableName;
  };

  // Determine included fields
  const getIncludedFields = () => {
    if (entry.tableName === 'clients') return 'Company, city, status';
    if (entry.tableName === 'meetings') return 'Client, agenda, outcome, photos';
    return 'Record fields';
  };

  // Determine result message
  const getResultMessage = () => {
    if (entry.status === 'synced') return 'Uploaded from this device';
    if (entry.status === 'conflict') return 'Conflict resolved: renamed';
    if (entry.status === 'failed' && entry.retryCount > 0) {
      return `Na-fail muna, successful sa ${entry.retryCount === 1 ? '2nd' : entry.retryCount + 1}nd retry`;
    }
    return 'Processing';
  };

  return (
    <YStack flex={1} backgroundColor={BIZLINK_COLORS.canvas} paddingTop={insets.top}>
      <BizTopBar title="Sync Record" fallbackHref="/(tabs)/more/sync-history" />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32 }}>
        {/* Status Badge */}
        <View alignSelf="flex-start" marginBottom="$3">
          <View
            backgroundColor={entry.status === 'synced' ? BIZLINK_COLORS.tintA : BIZLINK_COLORS.soft}
            borderRadius={999}
            paddingHorizontal={14}
            paddingVertical={6}
          >
            <Text fontSize={11} fontFamily={BIZLINK_FONTS.semibold} color={
              entry.status === 'synced' ? BIZLINK_COLORS.brand : BIZLINK_COLORS.muted
            }>
              {entry.status === 'synced' ? 'synced' : 
               entry.status === 'conflict' ? 'resolved' : 
               entry.retryCount > 0 ? 'retried' : 'processing'}
            </Text>
          </View>
        </View>

        {/* Title */}
        <Text fontSize={22} fontFamily={BIZLINK_FONTS.semibold} color={BIZLINK_COLORS.text} marginBottom="$4">
          {entry.label}
        </Text>

        {/* Record Information Card */}
        <YStack marginBottom="$3">
          <Text fontSize={16} fontFamily={BIZLINK_FONTS.semibold} color={BIZLINK_COLORS.text} marginBottom="$2.5">
            Record information
          </Text>

          <YStack gap="$2.5">
            <InfoRow label="Type:" value={getRecordType()} />
            <InfoRow label="Local record:" value={`${entry.tableName.slice(0, -1)}-${entry.id.slice(-3)}`} />
            <InfoRow label="Included:" value={getIncludedFields()} />
            <InfoRow label="Result:" value={getResultMessage()} />
            <InfoRow 
              label="Completed:" 
              value={new Date(entry.occurredAt).toLocaleString('en-US', { 
                month: 'short', 
                day: 'numeric', 
                hour: 'numeric', 
                minute: '2-digit', 
                hour12: true 
              })} 
            />
          </YStack>
        </YStack>

        {/* Device-Scoped History Notice */}
        <BizCard flat marginTop="$3">
          <YStack gap="$2">
            <YStack flexDirection="row" gap="$2" alignItems="center">
              <Smartphone size={18} color={BIZLINK_COLORS.text} strokeWidth={1.75} />
              <Text fontSize={14} fontFamily={BIZLINK_FONTS.semibold} color={BIZLINK_COLORS.text}>
                Device-scoped history
              </Text>
            </YStack>
            <Text fontSize={13} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted} lineHeight={19}>
              Impormasyon ng sariling record ng Sales user. Hindi ito admin-wide audit log.
            </Text>
          </YStack>
        </BizCard>
      </ScrollView>
    </YStack>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  const BIZLINK_COLORS = useBizlinkColors();
  
  return (
    <YStack gap="$0.5">
      <Text fontSize={13} fontFamily={BIZLINK_FONTS.semibold} color={BIZLINK_COLORS.muted}>
        {label}
      </Text>
      <Text fontSize={14} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.text}>
        {value}
      </Text>
    </YStack>
  );
}
