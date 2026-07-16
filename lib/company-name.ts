// T-005: must stay byte-for-byte equivalent to the (drafted, not-yet-applied)
// Postgres function in Migration-014-Report.md:
//   trim(regexp_replace(lower(raw), '[^a-z0-9]+', ' ', 'g'))
// so the local dup-check and the eventual server constraint agree on what
// counts as "the same company name". Change both sides together.
export function normalizeCompanyName(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

// Test vectors mirrored from the SQL doc's sanity-check comments, plus a few
// edge cases. No test runner is configured in this repo (see package.json) —
// this dev-time assertion is the drift guard until one exists.
const NORMALIZE_TEST_VECTORS: ReadonlyArray<readonly [string, string]> = [
  ['Oracle  Petroleum.', 'oracle petroleum'],
  ['ORACLE-PETROLEUM', 'oracle petroleum'],
  ['Oracle Petroleum', 'oracle petroleum'],
  ['  Oracle   Petroleum  ', 'oracle petroleum'],
  ["O'Brien & Sons, Inc.", 'o brien sons inc'],
  ['', ''],
];

if (process.env.NODE_ENV !== 'production') {
  for (const [input, expected] of NORMALIZE_TEST_VECTORS) {
    const actual = normalizeCompanyName(input);
    console.assert(
      actual === expected,
      `normalizeCompanyName(${JSON.stringify(input)}) = ${JSON.stringify(actual)}, expected ${JSON.stringify(expected)}`
    );
  }
}
