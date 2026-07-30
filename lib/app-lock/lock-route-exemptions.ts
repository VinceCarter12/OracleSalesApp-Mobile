/**
 * Batch 5 Slice 3 (ADR-051, "Manager reassignment screens carve-out"):
 * Vince's deliberate override of the architecture-reviewer's recommendation
 * — `app/(manager)/more/clients/**` (client reassignment / PO-approval flow)
 * must NEVER show the root-lock overlay, even while every other route is
 * locked. `LockGate` is a single global overlay mounted once above the
 * whole navigator, so this segment-based allowlist is how that one route
 * group is excluded without restructuring navigation.
 *
 * Segment-based (via expo-router's `useSegments()`), not pathname-based, so
 * it can never accidentally match a same-named route nested under a
 * different role's group (route groups like `(manager)` are present in
 * segments but stripped from `usePathname()`).
 */
const EXEMPT_ROUTE_SEGMENTS: readonly string[] = ['(manager)', 'more', 'clients'];

/**
 * True if `segments` (or any deeper route nested under it, e.g. the
 * reassignment flow's `.../more/clients/reassign`) falls under the
 * exempted route group.
 */
export function isExemptFromRootLock(segments: readonly string[]): boolean {
  return EXEMPT_ROUTE_SEGMENTS.every((segment, index) => segments[index] === segment);
}
