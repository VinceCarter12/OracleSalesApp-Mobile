import { type ReactNode, useEffect, useState } from 'react';
import { Animated } from 'react-native';

/**
 * 2026-08-08 (Vince: the Reports drill-down panel appeared/disappeared with
 * no transition at all): fade + rise entrance for whatever's passed in.
 * Mount `key`ed by the caller to whatever identifies the current selection
 * (e.g. the active filter) so switching between two already-open selections
 * replays the animation instead of just diffing in place — RN's built-in
 * `Animated` API, same pattern as `BizFilterSheetRow.tsx`, no reanimated
 * dependency.
 */
export function FadeInPanel({ children }: { children: ReactNode }) {
  const [progress] = useState(() => new Animated.Value(0));

  useEffect(() => {
    const anim = Animated.timing(progress, {
      toValue: 1,
      duration: 260,
      useNativeDriver: true,
    });
    anim.start();
    return () => anim.stop();
  }, [progress]);

  return (
    <Animated.View
      style={{
        opacity: progress,
        transform: [{ translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) }],
      }}
    >
      {children}
    </Animated.View>
  );
}
