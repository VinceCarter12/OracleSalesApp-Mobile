import { useTheme } from 'tamagui';

/** Corporate Emerald — official OracleSalesApp palette (ADR-011). Mirrors the CSS tokens in Wireframe-Agent-Executive.html. */
export const COLORS = {
  feather: '#005B36',
  mask: '#0B7A44',
  ledgeGreen: '#003D24',
  red: '#C0311B',
  ledgeRed: '#96230F',
  orange: '#B4740A',
  yellow: '#C99A2E',
  blue: '#0B2545',
  blueSoft: '#E8ECF2',
  blueBorder: '#C3CEDD',
  purple: '#24406B',
  purpleSoft: '#E7ECF3',
  snow: '#FFFFFF',
  polar: '#F5F7F6',
  swan: '#DDE3E0',
  swanLedge: '#AEB8B4',
  eel: '#16241D',
  hare: '#6B7A73',
  wolf: '#45534C',
  greenTint: '#E4F0EA',
  greenSoft: '#D7EBDF',
  redSoft: '#FBE7E2',
  amberSoft: '#FBF0DC',
} as const;

/** Outcome badge colors — mirrors .b-success/.b-follow/.b-nodec/.b-lost in Wireframe.html */
export const OUTCOME_BADGE_STYLES: Record<string, { background: string; color: string }> = {
  Successful: { background: COLORS.greenSoft, color: COLORS.ledgeGreen },
  'Follow-up Required': { background: COLORS.amberSoft, color: COLORS.orange },
  'No Decision': { background: COLORS.polar, color: COLORS.wolf },
  'Lost Opportunity': { background: COLORS.redSoft, color: COLORS.ledgeRed },
};

/** Inter font families (ADR-011) — loaded in app/_layout.tsx via @expo-google-fonts/inter. */
export const FONTS = {
  regular: 'Inter_400Regular',
  semibold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
  extrabold: 'Inter_800ExtraBold',
} as const;

/**
 * Emerald BizLink color tokens (ADR-024, Design-System-Catalog §1). Additive —
 * `COLORS` above is untouched until each screen's own migration phase
 * (ADR-024 Phase 2/3/4). New BizLink-styled screens/components should import
 * this object instead of `COLORS`.
 *
 * 2026-07-21 — dark mode: this is the LIGHT-mode value set, and is also the
 * fallback for any screen not yet migrated to `useBizlinkColors()` below.
 * These exact values are duplicated into `tamagui.config.ts`'s `bizlinkLight`
 * theme object — the two must be kept in sync (there's no single source of
 * truth split out, since Tamagui's `createTamagui()` needs plain literals at
 * module-init time, before any component/hook can run). Prefer
 * `useBizlinkColors()` in new/migrated code — it resolves to the DARK
 * palette automatically when the agent's theme preference is dark.
 */
export const BIZLINK_COLORS = {
  canvas: '#EFF3F1',
  card: '#FFFFFF',
  tintA: '#C7EAD8',
  tintB: '#FBE7E2',
  ink: '#003D24',
  brand: '#005B36',
  text: '#12271C',
  muted: '#6B7A73',
  red: '#C0311B',
  navy: '#0B2545',
  soft: '#E7ECE9',
  line: '#DFE7E2',
  // Semantic accents (Design-System-Catalog §1) — added in Phase 2 (T-014)
  // for warning/deadline banners (e.g. the 1-month prospect-deadline
  // warnrow, RSR quota widget) that Phase 1 didn't need yet.
  orange: '#B4740A',
  amberSoft: '#FBF0DC',
  yellow: '#C99A2E',
} as const;

/**
 * Translucent-white overlays for BizLink's dark ("ink") full-bleed screens
 * (e.g. the login screen) — named so opacity values stay consistent instead
 * of drifting per screen as more BizLink screens get built (ADR-024).
 */
export const BIZLINK_ON_INK = {
  // 2026-07-21: solid white text/icon color for content sitting on an `ink`
  // surface — added alongside dark mode. `BIZLINK_COLORS.card` used to
  // double as "white" for this purpose (safe when `card` was always white,
  // pre-dark-mode) but `card` is now theme-reactive (dark surface in dark
  // mode) and `ink` stays constant across both themes — so anything drawn
  // on an `ink` panel must use THIS instead of `BIZLINK_COLORS.card`, or it
  // goes dark-text-on-dark-bg in dark mode.
  solid: '#FFFFFF',
  circleFill: 'rgba(255,255,255,0.12)',
  circleBorder: 'rgba(255,255,255,0.35)',
  textMuted: 'rgba(255,255,255,0.6)',
  textMutedFooter: 'rgba(255,255,255,0.55)',
  placeholder: 'rgba(255,255,255,0.4)',
  inputFill: 'rgba(255,255,255,0.1)',
} as const;

/**
 * General Sans font families (ADR-024, Fontshare ITF Free Font License).
 * Registered via `useFonts` in app/_layout.tsx alongside Inter — the keys
 * passed to `useFonts` there must match these values exactly.
 */
export const BIZLINK_FONTS = {
  regular: 'GeneralSans-Regular',
  medium: 'GeneralSans-Medium',
  semibold: 'GeneralSans-Semibold',
  bold: 'GeneralSans-Bold',
} as const;

export type BizlinkColorTokens = { [K in keyof typeof BIZLINK_COLORS]: string };

/**
 * Theme-reactive replacement for the static `BIZLINK_COLORS` import — reads
 * the currently-active Tamagui theme (`tamagui.config.ts`'s `bizlinkLight`/
 * `bizlinkDark` token sets, switched via `<Theme name={resolvedTheme}>` in
 * `app/_layout.tsx`) instead of always returning the light-mode literals.
 * Must be called inside a component body (it's a hook) — screens/components
 * migrating to dark-mode support should replace
 * `import { BIZLINK_COLORS } from '.../theme'` with
 * `const BIZLINK_COLORS = useBizlinkColors();` and leave every other line
 * (all the `BIZLINK_COLORS.xxx` usages) unchanged — the shape is identical.
 */
export function useBizlinkColors(): BizlinkColorTokens {
  const theme = useTheme();
  return {
    canvas: theme.canvas.get(),
    card: theme.card.get(),
    tintA: theme.tintA.get(),
    tintB: theme.tintB.get(),
    ink: theme.ink.get(),
    brand: theme.brand.get(),
    text: theme.text.get(),
    muted: theme.muted.get(),
    red: theme.red.get(),
    navy: theme.navy.get(),
    soft: theme.soft.get(),
    line: theme.line.get(),
    orange: theme.orange.get(),
    amberSoft: theme.amberSoft.get(),
    yellow: theme.yellow.get(),
  };
}
