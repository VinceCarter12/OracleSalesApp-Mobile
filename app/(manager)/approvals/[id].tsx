import { useCallback, useEffect, useState } from 'react';
import { ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { CircleAlert } from 'lucide-react-native';
import { Spinner, Text, XStack, YStack } from 'tamagui';
import { BIZLINK_COLORS, BIZLINK_FONTS } from '../../../lib/theme';
import { useManagerApprovalFeed } from '../../../lib/use-manager-approval-feed';
import { isLikelyOnline } from '../../../lib/sync/connectivity';
import { decideClientEditRequest } from '../../../lib/client-edit-decision-service';
import { decidePoConfirmation } from '../../../lib/po-confirmation-manager-service';
import { classifyDecisionCode } from '../../../lib/policies/approval-decision-outcome';
import { getClientEditFieldLabel, formatClientEditFieldValue } from '../../../lib/client-edit-field-labels';
import { showToast } from '../../../lib/toast';
import { BizTopBar } from '../../../components/bizlink/BizTopBar';
import { BizCard } from '../../../components/bizlink/BizCard';
import { BizSectionHeader } from '../../../components/bizlink/BizSectionHeader';
import { BizButton } from '../../../components/bizlink/BizButton';
import { BizBadge } from '../../../components/bizlink/BizBadge';
import { BizDiffBox, type DiffField } from '../../../components/bizlink/BizDiffBox';
import { BizPendingBanner } from '../../../components/bizlink/BizPendingBanner';

const KIND_BADGE_LABEL = { client_edit: 'Client Edit', po_confirmation: 'PO Confirmation' } as const;

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
}

/**
 * Manager Approvals detail screen (Batch 6 PR B, ADR-052 section E/F).
 * Online-only decisions — Approve/Reject are disabled (with helper text)
 * when offline, correcting Wireframe-Manager-BizLink.html's
 * `decideApproval()` offline-queuing behavior (~line 1802-1810), which
 * ADR-052 explicitly documents as contradicting this design.
 */
export default function ManagerApprovalDetailScreen() {
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { rows, loading, error, reload } = useManagerApprovalFeed();

  const [online, setOnline] = useState(true);
  const [deciding, setDeciding] = useState(false);
  const [decideError, setDecideError] = useState<string | null>(null);
  const [conflict, setConflict] = useState(false);

  const checkOnline = useCallback(() => {
    isLikelyOnline().then(setOnline);
  }, []);

  useEffect(() => {
    checkOnline();
  }, [checkOnline]);

  useFocusEffect(useCallback(() => { checkOnline(); }, [checkOnline]));

  const row = rows.find((r) => r.requestId === id);

  async function handleDecision(decision: 'approved' | 'rejected'): Promise<void> {
    if (!row) return;
    setDeciding(true);
    setDecideError(null);
    setConflict(false);
    try {
      const code =
        row.requestKind === 'client_edit'
          ? await decideClientEditRequest(row.requestId, decision, null)
          : (await decidePoConfirmation(row.requestId, decision, null));
      switch (classifyDecisionCode(code)) {
        case 'success':
          // Navigating away unmounts this screen's own feed instance; the
          // list screen's useFocusEffect already refetches on return, so no
          // reload() here (would race a state update on an unmounting hook).
          showToast(code === 'approved' ? 'Na-approve ang request.' : 'Na-reject ang request.');
          router.back();
          break;
        case 'already_decided':
          // Not an error — someone else (or a retried tap) already decided
          // this request; per ADR-052 section E's decision-code mapping,
          // just inform and refetch so the list reflects reality.
          showToast('Na-desisyunan na ito.');
          await reload();
          break;
        case 'conflict':
          // Client record changed since the request was created — keep it
          // pending, surface the conflict banner, require a manual re-review.
          setConflict(true);
          await reload();
          break;
        case 'error':
          setDecideError('Hindi na-proseso ang desisyon. Subukan ulit.');
          await reload();
          break;
      }
    } catch (err) {
      setDecideError(err instanceof Error ? err.message : 'Hindi na-proseso ang desisyon. Subukan ulit.');
    } finally {
      setDeciding(false);
    }
  }

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
        <BizTopBar title="Approval Detail" />
        <YStack flex={1} justifyContent="center" alignItems="center" paddingHorizontal="$5">
          <Text fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted} textAlign="center">
            Wala nang approval — na-decide na ito o hindi ma-hanap.
          </Text>
        </YStack>
      </YStack>
    );
  }

  const isPending = row.status === 'pending';
  const kindVariant = row.requestKind === 'client_edit' ? 'edit' : 'request';

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
      <BizTopBar title="Approval Detail" />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32 }}>
        <BizCard gap="$1.5">
          <XStack alignItems="center" gap="$2">
            <BizBadge variant={kindVariant} label={KIND_BADGE_LABEL[row.requestKind]} />
            <BizBadge variant={row.status} label={row.status[0].toUpperCase() + row.status.slice(1)} />
          </XStack>
          <Text fontFamily={BIZLINK_FONTS.semibold} fontSize={17} color={BIZLINK_COLORS.text}>
            {row.clientName}
          </Text>
          <Text fontSize={12} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted}>
            Requested by {row.requesterName} · {formatDateTime(row.createdAt)}
          </Text>
        </BizCard>

        {isPending ? <YStack marginTop="$3"><BizPendingBanner since={row.createdAt} /></YStack> : null}

        {conflict ? (
          <XStack
            alignItems="center"
            gap="$2.5"
            backgroundColor={BIZLINK_COLORS.tintB}
            borderRadius={20}
            paddingHorizontal={16}
            paddingVertical={13}
            marginTop="$3"
          >
            <CircleAlert size={16} color={BIZLINK_COLORS.red} strokeWidth={1.75} />
            <Text flex={1} fontSize={12} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.red} lineHeight={17}>
              Client record changed — please review again.
            </Text>
          </XStack>
        ) : null}

        {row.requestKind === 'client_edit' ? (
          <>
            <BizSectionHeader title="Changes" />
            <BizDiffBox fields={diffFields} />
            {row.summary.reviewNote ? (
              <>
                <BizSectionHeader title="Note" />
                <BizCard>
                  <Text fontSize={13.5} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.text} lineHeight={19}>
                    {row.summary.reviewNote}
                  </Text>
                </BizCard>
              </>
            ) : null}
          </>
        ) : (
          <>
            <BizSectionHeader title="PO Evidence" />
            <BizCard gap="$1">
              <Text fontSize={13} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.text}>
                Meeting: {row.summary.meetingId}
              </Text>
              <Text fontSize={13} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.text}>
                PO photo: {row.summary.poPhotoPath}
              </Text>
            </BizCard>
          </>
        )}

        {isPending ? (
          <>
            {decideError ? (
              <Text fontSize={12.5} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.red} marginTop="$3">
                {decideError}
              </Text>
            ) : null}
            {!online ? (
              <Text fontSize={12} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted} marginTop="$3" textAlign="center">
                Online-only decision. Gagana kapag may signal.
              </Text>
            ) : null}
            <XStack gap="$2.5" marginTop="$3">
              <BizButton
                label="Reject"
                variant="white"
                disabled={!online || deciding}
                onPress={() => handleDecision('rejected')}
                style={{ flex: 1 }}
              />
              <BizButton
                label="Approve"
                disabled={!online || deciding}
                onPress={() => handleDecision('approved')}
                style={{ flex: 1 }}
              />
            </XStack>
          </>
        ) : null}
      </ScrollView>
    </YStack>
  );
}
