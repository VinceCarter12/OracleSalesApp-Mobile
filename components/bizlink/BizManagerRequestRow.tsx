import { Text, XStack, YStack } from 'tamagui';
import { useBizlinkColors, BIZLINK_FONTS } from '../../lib/theme';
import type { ManagerRequestRow } from '../../lib/manager-request-feed-service';
import { BizCard } from './BizCard';
import { BizBadge, type BizBadgeDecisionStatusVariant } from './BizBadge';
import { BizButton } from './BizButton';

interface BizManagerRequestRowProps {
  row: ManagerRequestRow;
  rowNumber: number;
  /** Only called for client_edit/po_confirmation rows — tag_along rows have no detail screen. */
  onPress: () => void;
  onAccept: () => void;
  onDecline: () => void;
  /** True while this row's own accept/decline call is in flight. */
  responding: boolean;
}

const KIND_BADGE_LABEL: Record<ManagerRequestRow['kind'], string> = {
  client_edit: 'Client Edit',
  po_confirmation: 'PO Confirmation',
  tag_along: 'Companion',
};

const KIND_BADGE_VARIANT: Record<ManagerRequestRow['kind'], 'edit' | 'request' | 'tagalong'> = {
  client_edit: 'edit',
  po_confirmation: 'request',
  tag_along: 'tagalong',
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

/**
 * Manager Requests inbox row (design-only merge, 2026-08-10) — combines
 * `BizApprovalRow` (client_edit/po_confirmation, tap-to-navigate) and the old
 * `app/(manager)/tag-along.tsx` inline avatar-card (accept/decline) into one
 * row shell, following the numbered-circle convention `BizMyRequestRow`
 * already established for the Sales-side merged inbox. `client_edit`/
 * `po_confirmation` rows are pressable and route to `approvals/[id]`;
 * `tag_along` rows render inline Accept/Decline `BizButton`s instead — same
 * as the retired screen, no tap-to-navigate affordance since there is no
 * tag-along detail screen.
 */
export function BizManagerRequestRow({
  row,
  rowNumber,
  onPress,
  onAccept,
  onDecline,
  responding,
}: BizManagerRequestRowProps) {
  const BIZLINK_COLORS = useBizlinkColors();
  const isTagAlong = row.kind === 'tag_along';
  // ADR-064: green is intentionally the "needs your decision" signal in
  // this work queue; decided rows return to the neutral card surface.
  const needsDecision = row.status === 'pending';
  const reviewNote =
    !isTagAlong && row.approval.requestKind === 'client_edit' ? row.approval.summary.reviewNote : null;

  return (
    <BizCard
      onPress={isTagAlong ? undefined : onPress}
      pressStyle={isTagAlong ? undefined : { opacity: 0.85 }}
      backgroundColor={needsDecision ? BIZLINK_COLORS.tintA : BIZLINK_COLORS.card}
      borderWidth={needsDecision ? 1 : 0}
      borderColor={needsDecision ? BIZLINK_COLORS.brand : 'transparent'}
      marginBottom={10}
      gap="$1.5"
    >
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
            {row.clientName}
          </Text>
          <Text fontSize={11.5} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted}>
            Requested by {row.requesterName} · {formatDate(row.createdAt)}
          </Text>
        </YStack>
      </XStack>

      <XStack alignItems="center" gap="$2">
        <BizBadge variant={KIND_BADGE_VARIANT[row.kind]} label={KIND_BADGE_LABEL[row.kind]} />
        <BizBadge variant={row.status} label={STATUS_BADGE_LABEL[row.status]} />
      </XStack>

      <Text fontSize={12.5} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.text}>
        {row.summary}
      </Text>

      {reviewNote ? (
        <Text fontSize={11.5} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted} numberOfLines={1}>
          Note: {reviewNote}
        </Text>
      ) : null}

      {isTagAlong && row.status === 'pending' ? (
        <XStack gap="$2" marginTop="$1">
          <BizButton label="Decline" variant="white" small disabled={responding} onPress={onDecline} style={{ flex: 1 }} />
          <BizButton label="Accept" small disabled={responding} onPress={onAccept} style={{ flex: 1 }} />
        </XStack>
      ) : null}
    </BizCard>
  );
}
