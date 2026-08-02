import { CLIENT_EDITABLE_FIELDS } from './policies/approval-policy';

// Batch 6 PR B: human-readable labels for `client_edit_requests.changes`
// keys, used by the Manager Approvals detail screen to build
// `BizDiffBox`'s `DiffField[]` from the raw snake_case field names in
// `ClientEditRequestChanges`. Deliberately its own tiny module rather than
// added to `lib/policies/approval-policy.ts` — that file owns WHICH fields
// are editable/approvable (a policy decision), this one owns HOW to display
// a field name (a presentation concern), same split as
// `lib/policies/po-confirmation-status-policy.ts` (status logic) vs. its
// `_LABELS`/`_TONES` display constants living alongside it, not in a
// separate policy file.
export const CLIENT_EDIT_FIELD_LABELS: Record<(typeof CLIENT_EDITABLE_FIELDS)[number], string> = {
  company_name: 'Company Name',
  contact_person: 'Contact Person',
  contact_position: 'Contact Position',
  contact_number: 'Contact Number',
  office_address: 'Office Address',
  sales_channel: 'Sales Channel',
  customer_type: 'Customer Type',
  minor_notes: 'Notes',
};

/** Falls back to the raw field key (title-cased) for any field outside the known allowlist, so an unexpected key never renders blank. */
export function getClientEditFieldLabel(field: string): string {
  const known = CLIENT_EDIT_FIELD_LABELS[field as (typeof CLIENT_EDITABLE_FIELDS)[number]];
  if (known) return known;
  return field
    .split('_')
    .map((word) => (word.length > 0 ? word[0].toUpperCase() + word.slice(1) : word))
    .join(' ');
}

/** `changes[field].old`/`.new` are `unknown` (any editable field's value, e.g. `customer_type`'s union) — this is the single place that turns one into `BizDiffBox`'s plain display string. */
export function formatClientEditFieldValue(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return JSON.stringify(value);
}
