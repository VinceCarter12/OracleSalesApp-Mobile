import { config } from '@tamagui/config/v3';
import { createTamagui } from 'tamagui';

// 2026-07-21: Emerald BizLink dark mode. Adds our own named tokens (canvas,
// card, tintA, tintB, ink, brand, text, muted, red, navy, soft, line,
// orange, amberSoft, yellow) onto Tamagui's stock 'light'/'dark' themes —
// merged in, not replacing v3's own tokens, so every existing Tamagui
// primitive (Checkbox, Spinner, etc.) keeps working unchanged. `lib/theme.ts`'s
// `useBizlinkColors()`/`useBizlinkFonts()` hooks read these via `useTheme()`,
// so this file is the single source of truth for both palettes — never hand-
// edit a hex value in `lib/theme.ts` without updating it here too.
//
// Design rule from Vince (2026-07-21): dark mode keeps the SAME brand/accent
// hues as light mode — only the light backgrounds (canvas/card/soft/line/
// tintA/tintB/amberSoft) and their paired text colors flip dark. `ink`
// (#003D24, already the darkest color in the palette — hero cards, floating
// nav, celebrate screen) is intentionally IDENTICAL in both themes, so those
// surfaces don't change at all between light/dark.
const bizlinkLight = {
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
  orange: '#B4740A',
  amberSoft: '#FBF0DC',
  yellow: '#C99A2E',
} as const;

const bizlinkDark = {
  canvas: '#101A15',
  card: '#1A2822',
  tintA: '#1E3B2E',
  tintB: '#3A211C',
  ink: '#003D24',
  brand: '#1C8F5D',
  text: '#ECF3EF',
  muted: '#93A39A',
  red: '#E15A45',
  navy: '#8FADD6',
  soft: '#243029',
  line: '#2B3A32',
  orange: '#D9971A',
  amberSoft: '#3A2E15',
  yellow: '#D9B24A',
} as const;

const tamaguiConfig = createTamagui({
  ...config,
  themes: {
    ...config.themes,
    light: { ...config.themes.light, ...bizlinkLight },
    dark: { ...config.themes.dark, ...bizlinkDark },
  },
});

export type AppConfig = typeof tamaguiConfig;

declare module 'tamagui' {
  interface TamaguiCustomConfig extends AppConfig {}
}

export default tamaguiConfig;
