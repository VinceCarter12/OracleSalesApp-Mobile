import { ChevronRight } from 'lucide-react-native';
import { Text, XStack, YStack } from 'tamagui';
import { useBizlinkColors, BIZLINK_FONTS } from '../../lib/theme';
import type { MyRequestRow } from '../../lib/my-request-status-service';
import { BizCard } from './BizCard';
import { BizBadge } from './BizBadge';

interface BizMyRequestRowProps {
  row: MyRequestRow;
  rowNumber: number;
  onPress: () => void;
}

// Wireframe `aRequestTypeLabel()` (Wireframe-Sales-BizLink.html ~line 1191).
const KIND_LABEL: Record<MyRequestRow['requestKind'], string> = {
  po_confirmation: 'PO confirmation',
  client_edit: 'Client edit',
  tag_along: 'Companion',
};

// Wireframe `aRequestStatusHtml()` labels (~line 1194).
const STATUS_LABEL: Record<MyRequestRow['status'], string> = {
  pending: 'Pending confirmation',
  approved: 'Approved',
  rejected: 'Declined',
  accepted: 'Accepted',
  declined: 'Declined',
  cancelled: 'Cancelled',
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/**
 * My Requests list row (Batch 8, `app/(tabs)/more/my-requests/index.tsx`).
 * Wireframe-Sales-BizLink.html's `aRenderMyRequests()` (~line 1202) renders a
 * "type · client name" title, "Submitted <date>" subtitle, and a status
 * badge — this composes `BizCard` the same way `BizApprovalRow` does. The
 * leading numbered circle (filled brand color, white number) reuses the
 * Maps meeting-list convention (`MapsMeetingCardList`) instead of a type icon.
 */
export function BizMyRequestRow({ row, rowNumber, onPress }: BizMyRequestRowProps) {
  const BIZLINK_COLORS = useBizlinkColors();

  return (
    <BizCard onPress={onPress} pressStyle={{ opacity: 0.85 }} marginBottom={10} gap="$1.5">
      <XStack alignItems="center" gap="$2.5">
        <YStack
          width={36}
          height={36}
          borderRadius={18}
          backgroundColor={BIZLINK_COLORS.brand}
          alignItems="center"
          justifyContent="center"
        >
          <Text fontSize={16} fontFamily={BIZLINK_FONTS.semibold} color="#FFFFFF">
            {rowNumber}
          </Text>
        </YStack>
        <YStack flex={1} gap="$0.5">
          <Text fontFamily={BIZLINK_FONTS.semibold} fontSize={14} color={BIZLINK_COLORS.text}>
            {KIND_LABEL[row.requestKind]} · {row.clientName}
          </Text>
          <Text fontSize={11.5} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted}>
            Submitted {formatDate(row.createdAt)}
          </Text>
        </YStack>
        <ChevronRight size={16} color={BIZLINK_COLORS.muted} strokeWidth={1.75} />
      </XStack>
      <XStack alignItems="center" justifyContent="space-between">
        <Text fontSize={11} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted}>
          Tap for complete details
        </Text>
        <BizBadge variant={row.status} label={STATUS_LABEL[row.status]} />
      </XStack>
    </BizCard>
  );
}
