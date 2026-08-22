import { describe, expect, it } from 'vitest';
import {
  canAttemptSubmission,
  canSubmitPoConfirmation,
  derivePoConfirmationDisplayStatus,
  isCloseDealPoEligible,
  derivePoConfirmationSlotState,
  PO_CONFIRMATION_REQUEST_KIND,
  blocksPoConfirmationReplacement,
  hasActivePoConfirmation,
  type LocalPoConfirmationStatus,
} from './po-confirmation-status-policy';

describe('derivePoConfirmationDisplayStatus', () => {
  it('renames a local draft to submission_required (ADR-046 point 7 vocabulary)', () => {
    expect(derivePoConfirmationDisplayStatus('draft')).toBe('submission_required');
  });

  it.each<LocalPoConfirmationStatus>(['pending', 'approved', 'rejected', 'cancelled'])(
    'passes %s through unchanged',
    (status) => {
      expect(derivePoConfirmationDisplayStatus(status)).toBe(status);
    }
  );
});

describe('canSubmitPoConfirmation', () => {
  it('only a draft row is submittable', () => {
    expect(canSubmitPoConfirmation('draft')).toBe(true);
    expect(canSubmitPoConfirmation('pending')).toBe(false);
    expect(canSubmitPoConfirmation('approved')).toBe(false);
    expect(canSubmitPoConfirmation('rejected')).toBe(false);
    expect(canSubmitPoConfirmation('cancelled')).toBe(false);
  });
});

describe('current-cycle duplicate guard', () => {
  it.each(['draft', 'pending', 'approved'] as const)('blocks %s as an active reservation', (status) => {
    expect(blocksPoConfirmationReplacement(status)).toBe(true);
  });
  it.each(['rejected', 'cancelled', 'superseded', 'duplicate_blocked'] as const)('permits replacement after %s', (status) => {
    expect(blocksPoConfirmationReplacement(status)).toBe(false);
  });
  it('does not let terminal history hide an older active reservation', () => {
    expect(hasActivePoConfirmation(['rejected', 'approved'])).toBe(true);
    expect(hasActivePoConfirmation(['duplicate_blocked', 'cancelled'])).toBe(false);
  });
});

describe('canAttemptSubmission (ADR-044 decision 5: online-only)', () => {
  it('a draft row while online is submittable', () => {
    expect(canAttemptSubmission('draft', true)).toBe(true);
  });

  it('never submits while offline, even a draft row', () => {
    expect(canAttemptSubmission('draft', false)).toBe(false);
  });

  it('never submits a non-draft row, even while online', () => {
    expect(canAttemptSubmission('pending', true)).toBe(false);
    expect(canAttemptSubmission('approved', true)).toBe(false);
    expect(canAttemptSubmission('rejected', true)).toBe(false);
    expect(canAttemptSubmission('cancelled', true)).toBe(false);
  });
});

describe('isCloseDealPoEligible (ADR-046 point 2 / Wireframe-Sales-BizLink.html:2152)', () => {
  it('is eligible only for in_progress + Successful outcome + Close deal agenda', () => {
    expect(isCloseDealPoEligible('in_progress', 'Successful', ['Close deal'])).toBe(true);
  });

  it('regression: Close deal selected + PO photo attached but a non-Successful outcome must NOT be eligible', () => {
    expect(isCloseDealPoEligible('in_progress', 'Follow-up Required', ['Close deal'])).toBe(false);
    expect(isCloseDealPoEligible('in_progress', 'No Decision', ['Close deal'])).toBe(false);
    expect(isCloseDealPoEligible('in_progress', 'Lost Opportunity', ['Close deal'])).toBe(false);
    expect(isCloseDealPoEligible('in_progress', null, ['Close deal'])).toBe(false);
  });

  it('is not eligible when Close deal is not selected, even with a Successful outcome', () => {
    expect(isCloseDealPoEligible('in_progress', 'Successful', ['Product / company presentation'])).toBe(false);
  });

  // ADR-061 (Vince, 2026-08-19/20): 'prospect' joins 'in_progress' as an
  // eligible status (Scenario 1 — a prospect may submit PO evidence
  // directly). Was: "is not eligible for any client status other than
  // in_progress".
  it('is eligible for in_progress and prospect only, never other statuses', () => {
    expect(isCloseDealPoEligible('in_progress', 'Successful', ['Close deal'])).toBe(true);
    expect(isCloseDealPoEligible('prospect', 'Successful', ['Close deal'])).toBe(true);
    expect(isCloseDealPoEligible('new', 'Successful', ['Close deal'])).toBe(false);
    expect(isCloseDealPoEligible('existing', 'Successful', ['Close deal'])).toBe(false);
    expect(isCloseDealPoEligible(null, 'Successful', ['Close deal'])).toBe(false);
    expect(isCloseDealPoEligible(undefined, 'Successful', ['Close deal'])).toBe(false);
  });
});

describe('PO_CONFIRMATION_REQUEST_KIND', () => {
  it('is the live RPC discriminator literal, never the "po" shorthand (ADR-046 correction addendum point 3)', () => {
    expect(PO_CONFIRMATION_REQUEST_KIND).toBe('po_confirmation');
  });
});

describe('derivePoConfirmationSlotState (B-125, Vince 2026-08-20)', () => {
  it('reports a free slot when there is no history at all', () => {
    expect(derivePoConfirmationSlotState([])).toBe('free');
  });

  it.each(['rejected', 'cancelled'] as const)('treats terminal %s history as a free slot', (status) => {
    expect(derivePoConfirmationSlotState([status])).toBe('free');
  });

  // The regression this whole change exists for: a draft that never reached
  // Supabase used to block a new PO forever.
  it.each(['draft', 'duplicate_blocked', 'superseded'] as const)(
    'treats local-only %s as replaceable, never as a block',
    (status) => {
      expect(derivePoConfirmationSlotState([status])).toBe('replaceable_local');
    }
  );

  it.each(['pending', 'approved'] as const)('still treats server-confirmed %s as a genuine reservation', (status) => {
    expect(derivePoConfirmationSlotState([status])).toBe('server_confirmed');
  });

  it('lets a server-confirmed row win over local-only evidence on the same cycle', () => {
    expect(derivePoConfirmationSlotState(['draft', 'pending'])).toBe('server_confirmed');
    expect(derivePoConfirmationSlotState(['pending', 'draft'])).toBe('server_confirmed');
  });

  it('ignores terminal history sitting alongside a local-only row', () => {
    expect(derivePoConfirmationSlotState(['rejected', 'draft'])).toBe('replaceable_local');
  });
});
