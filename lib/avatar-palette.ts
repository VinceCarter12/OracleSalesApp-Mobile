import { BIZLINK_COLORS } from './theme';

/**
 * B-054 Phase 1: replaces `lib/manager-data.ts`'s `AGENT_COLORS` (keyed on
 * meaningless mock ids like `a1`/`r1`) now that agent ids are real
 * `profiles.id` UUIDs with no natural color mapping. Deterministic hash of
 * the id mod a small fixed palette — same UUID always renders the same
 * color, no server state needed. Palette reuses the existing BizLink
 * tint/color token pairs (Design-System-Catalog) rather than inventing new
 * ones.
 */
const AVATAR_PALETTE: { background: string; color: string }[] = [
  { background: BIZLINK_COLORS.tintA, color: BIZLINK_COLORS.ink },
  { background: BIZLINK_COLORS.soft, color: BIZLINK_COLORS.navy },
  { background: BIZLINK_COLORS.tintB, color: BIZLINK_COLORS.red },
  { background: BIZLINK_COLORS.amberSoft, color: BIZLINK_COLORS.orange },
];

export function avatarPaletteFor(id: string): { background: string; color: string } {
  let hash = 0;
  for (let i = 0; i < id.length; i += 1) {
    hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  }
  return AVATAR_PALETTE[hash % AVATAR_PALETTE.length];
}
