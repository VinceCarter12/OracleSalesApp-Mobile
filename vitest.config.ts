import { defineConfig } from 'vitest/config';

// Pure function tests only — no jsdom environment needed. Scoped away from
// lib/feature-flags.ts (imports expo-secure-store, a native module) and any
// other expo-*/native-module-dependent file by the modules choosing not to
// import those, not by an include/exclude filter here.
export default defineConfig({
  test: {
    environment: 'node',
  },
});
