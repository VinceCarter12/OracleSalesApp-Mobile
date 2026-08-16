// Shared "first letter" rule for map marker chips (2026-08-16, Vince: pins
// that are too small and clump into indistinguishable dots should show an
// enlarged first letter instead, same treatment the "you are here" user
// marker already has — see `use-user-map-marker.ts`'s identical inline
// `charAt(0)` rule, which this does not touch/replace since it's a distinct
// identity-marker concept, not an office/meeting pin).
export function firstMarkerLetter(text: string): string {
  return text.trim().charAt(0).toUpperCase() || '?';
}
