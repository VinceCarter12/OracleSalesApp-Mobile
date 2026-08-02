// Batch 9 Step C fix (2026-08-02, quality-gate bug 1): reuses
// app/(tabs)/more/office-map/[id].tsx as-is (F-205/ADR-016 re-export
// pattern, same as app/(manager)/clients/office-location.tsx) — Managers
// never have `(tabs)` mounted (see app/_layout.tsx's Stack.Protected guard),
// so the Manager Lost Opportunity detail screen must link into a Manager-
// group route instead of reaching into `(tabs)`. The underlying screen is
// already generic (reads lat/lng/companyName/verified/fallback from query
// params), so no behavior changes — only the route this device stack lives
// under changes.
export { default } from '../../../(tabs)/more/office-map/[id]';
