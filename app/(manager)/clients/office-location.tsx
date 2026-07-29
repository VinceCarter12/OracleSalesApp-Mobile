// Batch 4 Office Location Core (2026-07-29): reuses
// app/(tabs)/clients/office-location.tsx as-is (F-205/ADR-016 re-export
// pattern) — Vince approved full Manager parity for this feature (screen
// reused, not gated by role), even though the Manager wireframe itself
// doesn't show this button (Sprint.md decision 2).
export { default } from '../../(tabs)/clients/office-location';
