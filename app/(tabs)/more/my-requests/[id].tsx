import { ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';
import { FileCheck2, PencilLine, Users } from 'lucide-react-native';
import { Spinner, Text, XStack, YStack } from 'tamagui';
import { BIZLINK_COLORS, BIZLINK_FONTS } from '../../../../lib/theme';
import { useMyRequestStatuses } from '../../../../lib/use-my-request-statuses';
import { getClientEditFieldLabel, formatClientEditFieldValue } from '../../../../lib/client-edit-field-labels';
import { BizTopBar } from '../../../../components/bizlink/BizTopBar';
import { BizCard } from '../../../../components/bizlink/BizCard';
import { BizSectionHeader } from '../../../../components/bizlink/BizSectionHeader';
import { BizButton } from '../../../../components/bizlink/BizButton';
import { BizBadge } from '../../../../components/bizlink/BizBadge';
import { BizDiffBox, type DiffField } from '../../../../components/bizlink/BizDiffBox';
import type { MyRequestRow } from '../../../../lib/my-request-status-service';

const KIND_LABEL: Record<MyRequestRow['requestKind'], string> = {
  po_confirmation: 'PO confirmation',
  client_edit: 'Client edit',
  tag_along: 'Tag-along',
};

const KIND_ICON: Record<MyRequestRow['requestKind'], typeof FileCheck2> = {
  po_confirmation: FileCheck2,
  client_edit: PencilLine,
  tag_along: Users,
};

const STATUS_LABEL: Record<MyRequestRow['status'], string> = {
  pending: 'Pending confirmation',
  approved: 'Approved',
  rejected: 'Declined',
  accepted: 'Accepted',
  declined: 'Declined',
  cancelled: 'Cancelled',
};

const INVITEE_KIND_CONTEXT: Record<'manager' | 'teammate', string> = {
  manager: 'Manager tag-along request',
  teammate: 'Teammate tag-along request',
};

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
}

/**
 * Wireframe `a-myrequestdetail` (Wireframe-Sales-BizLink.html ~line 894,
 * `aOpenMyRequest()` ~line 1205-1217). Type-specific body: PO photo
 * reference, a from→to diff card per changed field, or a tag-along context
 * line — plus a decline reason only when `summary.reviewNote` is present.
 * View-only: no approve/decline controls exist on this screen.
 */
export default function MyRequestDetailScreen() {
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { rows, loading, error, reload } = useMyRequestStatuses();
  const row = rows.find((r) => r.id === id);

  if (loading) {
    return (
      <YStack flex={1} justifyContent="center" alignItems="center" backgroundColor={BIZLINK_COLORS.canvas}>
        <Spinner size="large" color={BIZLINK_COLORS.brand} />
      </YStack>
    );
  }

  if (error) {
    return (
      <YStack flex={1} justifyContent="center" alignItems="center" backgroundColor={BIZLINK_COLORS.canvas} gap="$3" paddingHorizontal="$5">
        <Text fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted} textAlign="center">{error}</Text>
        <BizButton small label="Ulitin" variant="white" onPress={reload} />
      </YStack>
    );
  }

  if (!row) {
    return (
      <YStack flex={1} backgroundColor={BIZLINK_COLORS.canvas} paddingTop={insets.top}>
        <BizTopBar title="Request detail" fallbackHref="/(tabs)/more/my-requests" />
        <YStack flex={1} justifyContent="center" alignItems="center" paddingHorizontal="$5">
          <Text fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted} textAlign="center">
            Hindi ma-hanap ang request.
          </Text>
        </YStack>
      </YStack>
    );
  }

  const Icon = KIND_ICON[row.requestKind];
  const showDeclineReason =
    row.requestKind === 'client_edit' &&
    (row.status === 'rejected' || row.status === 'declined') &&
    row.summary.reviewNote;

  const diffFields: DiffField[] =
    row.requestKind === 'client_edit'
      ? Object.entries(row.summary.changes).map(([field, change]) => ({
          label: getClientEditFieldLabel(field),
          from: formatClientEditFieldValue(change.old),
          to: formatClientEditFieldValue(change.new),
        }))
      : [];

  return (
    <YStack flex={1} backgroundColor={BIZLINK_COLORS.canvas} paddingTop={insets.top}>
      <BizTopBar title="Request detail" fallbackHref="/(tabs)/more/my-requests" />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32 }}>
        <BizCard gap="$1.5">
          <XStack alignItems="flex-start" gap="$2">
            <YStack gap="$1.5" flex={1}>
              <XStack alignItems="center" gap="$1.5">
                <Icon size={13} color={BIZLINK_COLORS.navy} strokeWidth={1.75} />
                <Text fontSize={11} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.navy}>
                  {KIND_LABEL[row.requestKind]}
                </Text>
              </XStack>
              <Text fontFamily={BIZLINK_FONTS.semibold} fontSize={17} color={BIZLINK_COLORS.text}>
                {row.clientName}
              </Text>
              <Text fontSize={12} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted}>
                Submitted {formatDateTime(row.createdAt)}
                {row.decidedAt ? ` · Updated ${formatDateTime(row.decidedAt)}` : ''}
              </Text>
            </YStack>
            <YStack flexShrink={0}>
              <BizBadge variant={row.status} label={STATUS_LABEL[row.status]} />
            </YStack>
          </XStack>
        </BizCard>

        {row.requestKind === 'po_confirmation' ? (
          <>
            <BizSectionHeader title="PO evidence" />
            <BizCard>
              <Text fontSize={13} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.text}>
                Attached PO photo: {row.summary.poPhotoPath || 'Available after sync'}
              </Text>
            </BizCard>
          </>
        ) : null}

        {row.requestKind === 'client_edit' ? (
          <>
            <BizSectionHeader title="Requested changes" />
            {diffFields.length > 0 ? (
              <BizDiffBox fields={diffFields} />
            ) : (
              <BizCard flat>
                <Text fontSize={13} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted}>
                  No field detail available.
                </Text>
              </BizCard>
            )}
          </>
        ) : null}

        {row.requestKind === 'tag_along' ? (
          <>
            <BizSectionHeader title="Request context" />
            <BizCard>
              <Text fontSize={13} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.text}>
                {INVITEE_KIND_CONTEXT[row.summary.inviteeKind]}
              </Text>
            </BizCard>
          </>
        ) : null}

        {showDeclineReason && row.requestKind === 'client_edit' ? (
          <>
            <BizSectionHeader title="Manager reason" />
            <BizCard flat>
              <Text fontSize={13} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.text} lineHeight={19}>
                {row.summary.reviewNote}
              </Text>
            </BizCard>
          </>
        ) : null}

        <Text fontSize={12} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted} textAlign="center" marginTop="$4">
          View-only status. Manager decision ang server-authoritative.
        </Text>
      </ScrollView>
    </YStack>
  );
}
