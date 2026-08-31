import { Check } from 'lucide-react-native';
import { Text, XStack, YStack } from 'tamagui';
import { useBizlinkColors, BIZLINK_FONTS } from '../../lib/theme';
import type { ManagerRequestRow } from '../../lib/manager-request-feed-service';
import { getClientEditFieldLabel, formatClientEditFieldValue } from '../../lib/client-edit-field-labels';
import { BizCard } from './BizCard';
import { BizDiffBox, type DiffField } from './BizDiffBox';
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
  /** Bulk-approve selection mode is open on the inbox. */
  selecting?: boolean;
  /** This row can join a batch — a pending client edit. Only meaningful while `selecting`. */
  selectable?: boolean;
  selected?: boolean;
  /** An otherwise-selectable row belonging to a DIFFERENT agent than the open batch. */
  locked?: boolean;
  /** Replaces `onPress` while selecting: tapping toggles the tick instead of opening the detail screen. */
  onToggleSelect?: () => void;
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
 *
 * While the inbox's bulk-approve selection is open (2026-08-31) the numbered
 * circle becomes a tick target and a tap toggles the row instead of
 * navigating. The number is what the tick REPLACES rather than sits beside:
 * a row that is 36px of circle plus 36px of checkbox leaves nothing for the
 * client name on a phone, and the ordinal is the least load-bearing thing on
 * the card while you are picking which requests to approve.
 */
export function BizManagerRequestRow({
  row,
  rowNumber,
  onPress,
  onAccept,
  onDecline,
  responding,
  selecting = false,
  selectable = false,
  selected = false,
  locked = false,
  onToggleSelect,
}: BizManagerRequestRowProps) {
  const BIZLINK_COLORS = useBizlinkColors();
  const isTagAlong = row.kind === 'tag_along';
  // ADR-064: green is intentionally the "needs your decision" signal in
  // this work queue; decided rows return to the neutral card surface.
  const needsDecision = row.status === 'pending';
  // In selection mode the whole card is the tick target for eligible rows.
  // Everything else stops responding: navigating to the detail screen from
  // inside a half-built batch is how a manager loses track of what is ticked.
  const cardPress = selecting ? (selectable && !locked ? onToggleSelect : undefined) : (isTagAlong ? undefined : onPress);
  const reviewNote =
    !isTagAlong && row.approval.requestKind === 'client_edit' ? row.approval.summary.reviewNote : null;

  /**
   * The actual before -> after, rendered ON the row (Adrian, device test
   * 2026-08-31: "so that managers wont need to click each in order to see
   * whats the infos, so that he can just approve multiple").
   *
   * This is what makes bulk approve honest rather than merely fast. The row
   * used to say "2 fields changed", which tells a manager that something
   * changed but not what — so approving a batch off that line alone is
   * approving blind, and the only remedy was opening all of them, which is
   * exactly the work the batch exists to remove. Matches what the web
   * Approvals card has always shown.
   *
   * Every field, not a truncated preview: a cut-off diff sends the manager
   * back into the detail screen and undoes the point. `formatClientEditFieldValue`
   * renders an empty/null previous value as an em dash rather than the string
   * "null".
   */
  const diffFields: DiffField[] =
    !isTagAlong && row.approval.requestKind === 'client_edit'
      ? Object.entries(row.approval.summary.changes).map(([field, change]) => ({
          label: getClientEditFieldLabel(field),
          from: formatClientEditFieldValue(change.old),
          to: formatClientEditFieldValue(change.new),
        }))
      : [];

  return (
    <BizCard
      onPress={cardPress}
      pressStyle={cardPress ? { opacity: 0.85 } : undefined}
      backgroundColor={needsDecision ? BIZLINK_COLORS.tintA : BIZLINK_COLORS.card}
      marginBottom={10}
      gap="$1.5"
      opacity={locked ? 0.45 : 1}
      borderWidth={selected ? 2 : needsDecision ? 1 : 0}
      borderColor={selected || needsDecision ? BIZLINK_COLORS.brand : 'transparent'}
      accessibilityRole={selecting && selectable && !locked ? 'checkbox' : undefined}
      accessibilityState={selecting && selectable ? { checked: selected, disabled: locked } : undefined}
    >
      <XStack alignItems="center" gap="$2.5">
        {selecting && selectable ? (
          <YStack
            width={36}
            height={36}
            borderRadius={18}
            borderWidth={2}
            borderColor={selected ? BIZLINK_COLORS.brand : BIZLINK_COLORS.line}
            backgroundColor={selected ? BIZLINK_COLORS.brand : 'transparent'}
            alignItems="center"
            justifyContent="center"
          >
            {selected ? <Check size={18} color="#FFFFFF" strokeWidth={3} /> : null}
          </YStack>
        ) : (
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
        )}
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

      {/* The diff REPLACES the "N fields changed" summary for client edits —
          keeping both would state the count immediately above a list the
          reader can already count. PO and tag-along rows have no diff, so
          they keep their summary line. */}
      {diffFields.length > 0 ? (
        <BizDiffBox variant="inline" fields={diffFields} />
      ) : (
        <Text fontSize={12.5} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.text}>
          {row.summary}
        </Text>
      )}

      {reviewNote ? (
        <Text fontSize={11.5} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted} numberOfLines={1}>
          Note: {reviewNote}
        </Text>
      ) : null}

      {isTagAlong && row.status === 'pending' ? (
        <XStack gap="$2" marginTop="$1">
          <BizButton label="Decline" variant="white" small disabled={responding || selecting} onPress={onDecline} style={{ flex: 1 }} />
          <BizButton label="Accept" small disabled={responding || selecting} onPress={onAccept} style={{ flex: 1 }} />
        </XStack>
      ) : null}
    </BizCard>
  );
}
