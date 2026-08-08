/** Returns the calendar date in the business timezone used by cutoff periods. */
export function manilaCalendarDate(isoTimestamp: string): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Manila',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date(isoTimestamp));
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

/** ISO calendar dates sort lexicographically, so this is timezone-neutral. */
export function isDateWithinInclusiveRange(date: string, startsOn: string, endsOn: string): boolean {
  return date >= startsOn && date <= endsOn;
}
