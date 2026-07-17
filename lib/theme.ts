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
