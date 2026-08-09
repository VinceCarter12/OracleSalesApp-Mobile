import { useEffect, useState } from 'react';
import { Animated } from 'react-native';

/**
 * Shared "meeting is live" pulse (2026-08-09, Vince direct instruction) —
 * a slow 900ms/900ms loop feeding an Animated 0->1->0 value, used anywhere
 * the app needs a glanceable glow for "this is actively running right now"
 * (the Home "I-record ang meeting" tile, the Record Meeting client-picker
 * row number). Same RN `Animated` API used by `FadeInPanel`/
 * `BizFilterSheetRow` — no reanimated dependency. Stops and resets to 0
 * whenever `active` goes false so an inactive consumer never keeps an
 * animation ticking in the background.
 */
export function usePulseGlow(active: boolean): Animated.Value {
  const [pulse] = useState(() => new Animated.Value(0));
  useEffect(() => {
    if (!active) {
      pulse.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 900, useNativeDriver: false }),
        Animated.timing(pulse, { toValue: 0, duration: 900, useNativeDriver: false }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [active, pulse]);
  return pulse;
}
