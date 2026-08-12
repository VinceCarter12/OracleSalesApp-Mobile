import { useState } from 'react';
import { runSync } from './sync-engine';
import { declareClientLost } from './lost-opportunity-declare-service';
import { mapLostOpportunityDeclareCode, isDeclareSuccess } from './policies/lost-opportunity-declare-policy';
import { AccountSuspendedError } from './app-lock/account-status';
import { showToast } from './toast';

interface UseDeclareLostOpportunityArgs {
  clientId: string;
  profileId: string | null;
  teamId: string | null;
  /** Same account-suspension handling as complete.tsx's handleSubmit catch block. */
  onSuspended: () => void;
  /** Called after a successful declare, once the post-write sync-down attempt has settled. */
  onDeclared: () => void;
}

/**
 * Business logic for Complete Info's "Declare lost opportunity" action
 * (Migration 088, `declare_client_lost()`). Components only render; this
 * hook owns dialog visibility, the reason draft, and the RPC call —
 * `_meta/engineering-principles.md`'s hooks-hold-logic convention, same
 * split already used by `lib/use-lost-opportunities.ts`.
 */
export function useDeclareLostOpportunity({
  clientId,
  profileId,
  teamId,
  onSuspended,
  onDeclared,
}: UseDeclareLostOpportunityArgs) {
  const [visible, setVisible] = useState(false);
  const [reason, setReason] = useState('');
  const [reasonError, setReasonError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function open(): void {
    setReason('');
    setReasonError(null);
    setVisible(true);
  }

  function close(): void {
    if (submitting) return;
    setVisible(false);
  }

  async function confirm(): Promise<void> {
    const trimmed = reason.trim();
    if (trimmed.length === 0) {
      setReasonError(mapLostOpportunityDeclareCode('reason_required'));
      return;
    }
    setReasonError(null);
    setSubmitting(true);
    try {
      const code = await declareClientLost(clientId, trimmed);
      if (isDeclareSuccess(code)) {
        showToast(mapLostOpportunityDeclareCode(code));
        // Direct online-only write, no outbox row (same pattern as
        // claimLostOpportunity()) — pull down so the client's local mirror
        // row is removed (ADR-026 P1) before the caller navigates away.
        if (profileId) {
          await runSync(profileId, teamId);
        }
        setVisible(false);
        onDeclared();
        return;
      }
      showToast(mapLostOpportunityDeclareCode(code));
      setVisible(false);
    } catch (err) {
      if (err instanceof AccountSuspendedError) {
        onSuspended();
      } else {
        showToast(err instanceof Error ? err.message : "The lost-opportunity declaration couldn't be processed. Try again.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return { visible, open, close, reason, setReason, reasonError, submitting, confirm };
}
