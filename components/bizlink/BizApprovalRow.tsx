import { Text, XStack } from 'tamagui';
import { useBizlinkColors, BIZLINK_FONTS } from '../../lib/theme';
import type { ManagerApprovalFeedRow } from '../../lib/manager-approval-feed-service';
import { BizCard } from './BizCard';
import { BizBadge, type BizBadgeDecisionStatusVariant } from './BizBadge';

interface BizApprovalRowProps {
  row: ManagerApprovalFeedRow;
  onPress: () => void;
}

const KIND_BADGE_LABEL: Record<ManagerApprovalFeedRow['requestKind'], string> = {
  client_edit: 'Client Edit',
  po_confirmation: 'PO Confirmation',
};

const STATUS_BADGE_LABEL: Record<BizBadgeDecisionStatusVariant, string> = {
  pending: 'Pending',
  approved: 'Approved',
  rejected: 'Rejected',
  accepted: 'Approved',
  declined: 'Rejected',
  cancelled: 'Cancelled',
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function summaryLine(row: ManagerApprovalFeedRow): string {
  if (row.requestKind === 'client_edit') {
    const count = row.summary.fieldCount;
    return `${count} field${count === 1 ? '' : 's'} changed`;
  }
  return 'PO evidence attached';
}

/**
 * Design-System-Catalog §"Needed before implementation" BizApprovalRow —
 * list row for `app/(manager)/approvals/index.tsx`. Wireframe-Manager-BizLink.html
 * `.approw` (line 313: card bg, radius 24, shadow) is exactly `BizCard`'s own
 * styling, so this composes `BizCard` rather than reimplementing the row
 * shell.
 */
export function BizApprovalRow({ row, onPress }: BizApprovalRowProps) {
  const BIZLINK_COLORS = useBizlinkColors();
  const kindVariant = row.requestKind === 'client_edit' ? 'edit' : 'request';
  const reviewNote = row.requestKind === 'client_edit' ? row.summary.reviewNote : null;

  return (
    <BizCard onPress={onPress} pressStyle={{ opacity: 0.85 }} marginBottom={10} gap="$1.5">
      <XStack alignItems="center" gap="$2">
        <BizBadge variant={kindVariant} label={KIND_BADGE_LABEL[row.requestKind]} />
        <BizBadge variant={row.status} label={STATUS_BADGE_LABEL[row.status]} />
        <Text fontSize={11} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted} marginLeft="auto">
          {formatDate(row.createdAt)}
        </Text>
      </XStack>
      <Text fontFamily={BIZLINK_FONTS.semibold} fontSize={14} color={BIZLINK_COLORS.text}>
        {row.clientName}
      </Text>
      <Text fontSize={11.5} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted}>
        Requested by {row.requesterName}
      </Text>
      <Text fontSize={12.5} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.text}>
        {summaryLine(row)}
      </Text>
      {reviewNote ? (
        <Text fontSize={11.5} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted} numberOfLines={1}>
          Note: {reviewNote}
        </Text>
      ) : null}
    </BizCard>
  );
}
