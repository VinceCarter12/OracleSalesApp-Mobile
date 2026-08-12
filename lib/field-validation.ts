/**
 * Pure client-side field validation rules/constraints (2026-08-09, Vince
 * direction): character caps for every data-entry field and format checks
 * for the values the app treats as structured (Philippine mobile number,
 * email). Kept free of React state so every screen (and the offline write
 * path) shares one tested source of truth — `_meta/engineering-principles.md`
 * reuse-first; UI screens only render what these functions decide.
 *
 * Deliberately excludes the `(collection)` and `(delivery)` role screens
 * (Vince directive) — those modules keep their own field behavior.
 */

export const CONTACT_NUMBER_MAX_LENGTH = 11;
export const COMPANY_NAME_MAX_LENGTH = 120;
export const CONTACT_PERSON_MAX_LENGTH = 100;
export const POSITION_MAX_LENGTH = 100;
export const OFFICE_ADDRESS_MAX_LENGTH = 255;
export const MINOR_NOTES_MAX_LENGTH = 500;
export const REMARKS_MAX_LENGTH = 500;
export const OTHER_LOCATION_MAX_LENGTH = 100;
/**
 * NOTE (Vince, 2026-08-09): the app no longer enforces a minimum password
 * length on sign-in — the gate locked out the team's shared/common password
 * (`opc1983!`, used across several test/agent accounts). That client-side
 * check is REMOVED from `app/(auth)/login.tsx` on purpose. If a password
 * rule is ever re-added, it must NOT reject `opc1983!` (exactly 8 chars) or
 * any other legacy/shared account password. Keep this constant as the
 * ceiling for "safe to allow" rather than re-wiring login to it.
 */
export const PASSWORD_MIN_LENGTH = 8;

export const CONTACT_NUMBER_INVALID_MESSAGE =
  'The contact number must be 11 digits starting with 09 (e.g. 0917 123 4567).';
export const EMAIL_INVALID_MESSAGE = 'This email address is not valid.';
export const PASSWORD_TOO_SHORT_MESSAGE = `The password must have at least ${PASSWORD_MIN_LENGTH} characters.`;

/**
 * Strips everything but digits and caps the result at 11 — wired into the
 * Contact Number input's `onChangeText` so a field phone-pad can never
 * produce letters, spaces, or a 12-digit number.
 */
export function sanitizeContactNumber(value: string): string {
  return value.replace(/\D/g, '').slice(0, CONTACT_NUMBER_MAX_LENGTH);
}

/**
 * True when the value is a proper Philippine mobile number: exactly 11
 * digits starting with `09` (`^09\d{9}$`).
 */
export function isValidContactNumber(value: string): boolean {
  return /^09\d{9}$/.test(value);
}

/** Basic structural email check — a real address must have a user@domain.tld shape. */
export function isValidEmail(value: string): boolean {
  const trimmed = String(value).trim();
  const atIndex = trimmed.lastIndexOf('@');
  if (atIndex <= 0 || atIndex === trimmed.length - 1) return false;
  const domain = trimmed.slice(atIndex + 1);
  if (domain.length < 3 || domain.length > 254) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed);
}