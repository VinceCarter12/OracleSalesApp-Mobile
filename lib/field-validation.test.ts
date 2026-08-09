import { describe, expect, it } from 'vitest';
import {
  CONTACT_NUMBER_MAX_LENGTH,
  COMPANY_NAME_MAX_LENGTH,
  CONTACT_PERSON_MAX_LENGTH,
  POSITION_MAX_LENGTH,
  OFFICE_ADDRESS_MAX_LENGTH,
  MINOR_NOTES_MAX_LENGTH,
  REMARKS_MAX_LENGTH,
  OTHER_LOCATION_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  sanitizeContactNumber,
  isValidContactNumber,
  isValidEmail,
} from './field-validation';

describe('sanitizeContactNumber', () => {
  it('keeps a normal 11-digit mobile number', () => {
    expect(sanitizeContactNumber('09171234567')).toBe('09171234567');
  });

  it('strips spaces, dashes, and letters', () => {
    expect(sanitizeContactNumber('0917 123-4567')).toBe('09171234567');
    expect(sanitizeContactNumber('call-09171234567')).toBe('09171234567');
  });

  it('caps the result at 11 digits', () => {
    expect(sanitizeContactNumber('0917123456789')).toHaveLength(CONTACT_NUMBER_MAX_LENGTH);
    expect(sanitizeContactNumber('0917123456789')).toBe('09171234567');
  });

  it('returns empty string for no digits', () => {
    expect(sanitizeContactNumber('abc - ()')).toBe('');
  });
});

describe('isValidContactNumber', () => {
  it('accepts a full 09 mobile number', () => {
    expect(isValidContactNumber('09171234567')).toBe(true);
  });

  it('rejects numbers not starting with 09', () => {
    expect(isValidContactNumber('91234567890')).toBe(false);
    expect(isValidContactNumber('08171234567')).toBe(false);
  });

  it('rejects short and long values', () => {
    const ten = '0917123456';
    expect(isValidContactNumber(ten)).toBe(false);
    expect(isValidContactNumber('091712345678')).toBe(false);
  });

  it('rejects empty and non-numeric input', () => {
    expect(isValidContactNumber('')).toBe(false);
    expect(isValidContactNumber('0917 123 4567')).toBe(false);
    expect(isValidContactNumber('0917abc4567')).toBe(false);
  });
});

describe('isValidEmail', () => {
  it('accepts a typical address', () => {
    expect(isValidEmail('agent@oraclecorp.com')).toBe(true);
  });

  it('trims surrounding whitespace', () => {
    expect(isValidEmail('  agent@oraclecorp.com ')).toBe(true);
  });

  it('rejects addresses without a domain or TLD', () => {
    expect(isValidEmail('agent@')).toBe(false);
    expect(isValidEmail('agent@oraclecorp')).toBe(false);
    expect(isValidEmail('agent')).toBe(false);
    expect(isValidEmail('@oraclecorp.com')).toBe(false);
  });
});

describe('field length caps', () => {
  it('exposes the documented caps', () => {
    expect(COMPANY_NAME_MAX_LENGTH).toBe(120);
    expect(CONTACT_PERSON_MAX_LENGTH).toBe(100);
    expect(POSITION_MAX_LENGTH).toBe(100);
    expect(OFFICE_ADDRESS_MAX_LENGTH).toBe(255);
    expect(MINOR_NOTES_MAX_LENGTH).toBe(500);
    expect(REMARKS_MAX_LENGTH).toBe(500);
    expect(OTHER_LOCATION_MAX_LENGTH).toBe(100);
    expect(PASSWORD_MIN_LENGTH).toBe(8);
  });
});