import { Smartphone } from 'lucide-react-native';
import { Text, View, YStack } from 'tamagui';
import { useBizlinkColors, BIZLINK_FONTS } from '../../lib/theme';
import type { SyncHistoryEntry } from '../../lib/sync-history';
import { getDisplayStatus, getResultMessage, SYNC_TABLE_LABEL } from '../../lib/sync-history-display';
import { BizCard } from '../bizlink/BizCard';

interface SyncRecordDetailProps {
  entry: SyncHistoryEntry;
  /**
   * Sales' detail screen (`Wireframe-Sales-BizLink.html`
   * `aOpenSyncHistoryDetail()`) shows Type/Local record/Included/Result/
   * Completed. Manager's (`Wireframe-Manager-BizLink.html`
   * `openSyncHistoryDetail()`) shows only Result/Completed — a real
   * wireframe difference between the two roles, not a stylistic choice.
   */
  showFullFields: boolean;
  /** Device-scoped history notice copy — differs by role in both wireframes. */
  noticeText: string;
}

/**
 * Shared "Sync Record" detail body for both roles' sync-history detail
 * screens — status badge, title, "Record information" rows, and the
 * device-scoped history notice card. Screens own `BizTopBar`/`ScrollView`/
 * loading/not-found states.
 */
export function SyncRecordDetail({ entry, showFullFields, noticeText }: SyncRecordDetailProps) {
  const BIZLINK_COLORS = useBizlinkColors();
  const displayStatus = getDisplayStatus(entry);

  function getRecordType(): string {
    return SYNC_TABLE_LABEL[entry.tableName] ?? entry.tableName;
  }

  function getIncludedFields(): string {
    if (entry.tableName === 'clients') return 'Company, city, status';
    if (entry.tableName === 'meetings') return 'Client, agenda, outcome, photos';
    if (entry.tableName === 'client_edit_requests') return 'Requested field changes';
    if (entry.tableName === 'collection_visits') return 'Client, amount, photos';
    if (entry.tableName === 'purchase_orders') return 'Client, items, quantities';
    if (entry.tableName === 'remittances' || entry.tableName === 'cod_remittances') return 'Amount, reference, photo';
    if (entry.tableName === 'tag_along_requests') return 'Requester, meeting, status';
    if (entry.tableName === 'pending_uploads') return 'Photo file';
    return 'Record fields';
  }

  const completedAt = new Date(entry.occurredAt).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });

  return (
    <BizCard>
      {/* Status Badge */}
      <View alignSelf="flex-start" marginBottom="$3">
        <View
          backgroundColor={displayStatus === 'synced' ? BIZLINK_COLORS.tintA : BIZLINK_COLORS.soft}
          borderRadius={999}
          paddingHorizontal={14}
          paddingVertical={6}
        >
          <Text fontSize={11} fontFamily={BIZLINK_FONTS.semibold} color={displayStatus === 'synced' ? BIZLINK_COLORS.brand : BIZLINK_COLORS.muted}>
            {displayStatus}
          </Text>
        </View>
      </View>

      {/* Title */}
      <Text fontSize={22} fontFamily={BIZLINK_FONTS.semibold} color={BIZLINK_COLORS.text} marginBottom="$4">
        {entry.label}
      </Text>

      {/* Record Information */}
      <YStack marginBottom="$3">
        <Text fontSize={16} fontFamily={BIZLINK_FONTS.semibold} color={BIZLINK_COLORS.text} marginBottom="$2.5">
          Record information
        </Text>

        <YStack>
          {showFullFields ? (
            <>
              <InfoRow label="Type:" value={getRecordType()} />
              <InfoRow label="Local record:" value={`${entry.tableName.slice(0, -1)}-${entry.id.slice(-3)}`} />
              <InfoRow label="Included:" value={getIncludedFields()} />
            </>
          ) : null}
          <InfoRow label="Result:" value={getResultMessage(entry)} />
          <InfoRow label="Completed:" value={completedAt} />
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
            {noticeText}
          </Text>
        </YStack>
      </BizCard>
    </BizCard>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  const BIZLINK_COLORS = useBizlinkColors();

  return (
    <Text fontSize={13.5} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.text} lineHeight={26}>
      <Text fontFamily={BIZLINK_FONTS.semibold} color={BIZLINK_COLORS.text}>
        {label}{' '}
      </Text>
      {value}
    </Text>
  );
}
