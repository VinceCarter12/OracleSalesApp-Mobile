import { describe, expect, it } from 'vitest';
import { getClientEditFieldLabel, formatClientEditFieldValue } from './client-edit-field-labels';

describe('getClientEditFieldLabel', () => {
  it('maps every CLIENT_EDITABLE_FIELDS entry to a human-readable label', () => {
    expect(getClientEditFieldLabel('company_name')).toBe('Company Name');
    expect(getClientEditFieldLabel('contact_person')).toBe('Contact Person');
    expect(getClientEditFieldLabel('contact_position')).toBe('Contact Position');
    expect(getClientEditFieldLabel('contact_number')).toBe('Contact Number');
    expect(getClientEditFieldLabel('office_address')).toBe('Office Address');
    expect(getClientEditFieldLabel('sales_channel')).toBe('Sales Channel');
    expect(getClientEditFieldLabel('customer_type')).toBe('Customer Type');
    expect(getClientEditFieldLabel('minor_notes')).toBe('Notes');
  });

  it('title-cases an unknown snake_case field instead of rendering blank', () => {
    expect(getClientEditFieldLabel('some_unexpected_field')).toBe('Some Unexpected Field');
  });
});

describe('formatClientEditFieldValue', () => {
  it('renders null/undefined/empty-string as an em dash', () => {
    expect(formatClientEditFieldValue(null)).toBe('—');
    expect(formatClientEditFieldValue(undefined)).toBe('—');
    expect(formatClientEditFieldValue('')).toBe('—');
  });

  it('passes strings through unchanged', () => {
    expect(formatClientEditFieldValue('Dealer')).toBe('Dealer');
  });

  it('stringifies numbers/booleans', () => {
    expect(formatClientEditFieldValue(42)).toBe('42');
    expect(formatClientEditFieldValue(true)).toBe('true');
  });

  it('JSON-stringifies anything else as a last resort', () => {
    expect(formatClientEditFieldValue({ a: 1 })).toBe('{"a":1}');
  });
});
