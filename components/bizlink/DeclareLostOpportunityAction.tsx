import { YStack } from 'tamagui';
import { useDeclareLostOpportunity } from '../../lib/use-declare-lost-opportunity';
import { LostOpportunityDialog } from '../meetings/LostOpportunityDialog';
import { BizButton } from './BizButton';

interface DeclareLostOpportunityActionProps {
  clientId: string;
  profileId: string | null;
  teamId: string | null;
  onSuspended: () => void;
  /** Called after a successful declare (post sync-down) — caller navigates away. */
  onDeclared: () => void;
}

/**
 * Complete Info's "Declare lost opportunity" control (Migration 088). Only
 * renders — all state/RPC logic lives in `useDeclareLostOpportunity()`.
 * Caller (`app/(tabs)/clients/complete.tsx`) is responsible for the
 * visibility gate (owning agent or manager-owns-own-client, per Vince's
 * 2026-08-11 decision) since that depends on role/client fields this
 * component doesn't need to know about.
 */
export function DeclareLostOpportunityAction({
  clientId,
  profileId,
  teamId,
  onSuspended,
  onDeclared,
}: DeclareLostOpportunityActionProps) {
  const { visible, open, close, reason, setReason, reasonError, submitting, confirm } =
    useDeclareLostOpportunity({ clientId, profileId, teamId, onSuspended, onDeclared });

  return (
    <YStack marginTop="$3">
      <BizButton label="Declare lost opportunity" variant="red" onPress={open} />
      <LostOpportunityDialog
        visible={visible}
        onCancel={close}
        onConfirm={confirm}
        reason={reason}
        onReasonChange={setReason}
        reasonError={reasonError}
        confirmDisabled={submitting}
      />
    </YStack>
  );
}
