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
