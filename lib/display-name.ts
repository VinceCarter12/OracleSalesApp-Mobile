/** Derives 1-2 letter initials from a full name, matching Avatar's expected format (e.g. "Juan Dela Cruz" → "JD"). */
export function initialsFromName(fullName: string | null): string {
  if (!fullName?.trim()) return '?';
  const parts = fullName.trim().split(/\s+/);
  const initials = parts.length === 1 ? parts[0].slice(0, 2) : parts[0][0] + parts[parts.length - 1][0];
  return initials.toUpperCase();
}

/** First name only, for the "Kamusta, {name}!" greeting. Empty string if unknown — caller falls back to a plain "Kamusta!". */
export function firstName(fullName: string | null): string {
  if (!fullName?.trim()) return '';
  return fullName.trim().split(/\s+/)[0];
}
