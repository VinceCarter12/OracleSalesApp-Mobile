import { describe, expect, it } from 'vitest';
import {
  canAttemptSubmission,
  canSubmitPoConfirmation,
  derivePoConfirmationDisplayStatus,
  isCloseDealPoEligible,
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

  it('is not eligible for any client status other than in_progress', () => {
    expect(isCloseDealPoEligible('prospect', 'Successful', ['Close deal'])).toBe(false);
    expect(isCloseDealPoEligible('new', 'Successful', ['Close deal'])).toBe(false);
    expect(isCloseDealPoEligible(null, 'Successful', ['Close deal'])).toBe(false);
    expect(isCloseDealPoEligible(undefined, 'Successful', ['Close deal'])).toBe(false);
  });
});

describe('PO_CONFIRMATION_REQUEST_KIND', () => {
  it('is the live RPC discriminator literal, never the "po" shorthand (ADR-046 correction addendum point 3)', () => {
    expect(PO_CONFIRMATION_REQUEST_KIND).toBe('po_confirmation');
  });
});
