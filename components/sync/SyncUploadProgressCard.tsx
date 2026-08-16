import { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, PanResponder, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CloudUpload } from 'lucide-react-native';
import { Text, View } from 'tamagui';
import { BIZLINK_COLORS, BIZLINK_FONTS } from '../../lib/theme';
import {
  getSyncProgressPercent,
  subscribeSyncProgress,
  type SyncProgressState,
} from '../../lib/sync/sync-progress';

// Floating "Uploading... N%" card (Vince direction, 2026-08-16) — mounted
// once near the root (app/_layout.tsx), above every role's tab group, so it
// overlays regardless of which screen is active. Subscribes to
// lib/sync/sync-progress.ts, which sync-engine.ts drives from real
// outbox/pending_uploads push progress. No wireframe covers this yet (a
// product-owner-approved addition, not a wireframe port) — still held to the
// existing Corporate Emerald BizLink tokens/spacing rules.
//
// Drag behavior: starts expanded (full card + bar). Dragging up past a small
// threshold swaps it for a small pill/chip that peeks from the top edge;
// dragging that pill back down swaps it back to the full card. Simplification
// (deliberate, not an oversight): the content SWAPS at release rather than
// morphing continuously mid-drag — a live `translateY` only provides small
// tactile follow-the-finger feedback during the drag itself, snapping back to
// rest once released. Built on React Native core's PanResponder/Animated —
// this repo has no react-native-gesture-handler/reanimated dependency (see
// package.json), so no new native dependency was added for this.

const DRAG_FOLLOW_CLAMP = 40;
const DRAG_THRESHOLD = 36;
const DONE_DISMISS_DELAY_MS = 2000;

type CardMode = 'expanded' | 'minimized';
type CardPhase = 'idle' | 'active' | 'done';

/** Subscribes to lib/sync/sync-progress.ts and derives the card's lifecycle phase — separated from the drag/layout concerns below for readability. */
function usePushProgressPhase(onNewPassStart: () => void) {
  const [phase, setPhase] = useState<CardPhase>('idle');
  const [progress, setProgress] = useState<SyncProgressState | null>(null);
  const doneTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const unsubscribe = subscribeSyncProgress((state) => {
      if (state) {
        if (doneTimerRef.current) {
          clearTimeout(doneTimerRef.current);
          doneTimerRef.current = null;
        }
        setProgress(state);
        setPhase('active');
        // A brand-new pass (completed === 0) always starts expanded, per spec.
        if (state.completed === 0) onNewPassStart();
      } else {
        setPhase((prev) => {
          if (prev !== 'active') return prev;
          doneTimerRef.current = setTimeout(() => setPhase('idle'), DONE_DISMISS_DELAY_MS);
          return 'done';
        });
      }
    });
    return () => {
      unsubscribe();
      if (doneTimerRef.current) clearTimeout(doneTimerRef.current);
    };
  }, [onNewPassStart]);

  return { phase, progress };
}

function ExpandedCard({ label, percent }: { label: string; percent: number }) {
  return (
    <View
      backgroundColor={BIZLINK_COLORS.card}
      borderRadius={24}
      paddingHorizontal={16}
      paddingVertical={12}
      minHeight={44}
      minWidth={220}
      gap={8}
      style={styles.shadow}
    >
      <View flexDirection="row" alignItems="center" gap={8}>
        <CloudUpload size={18} color={BIZLINK_COLORS.brand} strokeWidth={1.75} />
        <Text fontSize={13} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.text}>
          {label}
        </Text>
      </View>
      <View height={6} borderRadius={999} backgroundColor={BIZLINK_COLORS.soft} overflow="hidden">
        <View height={6} borderRadius={999} backgroundColor={BIZLINK_COLORS.brand} width={`${percent}%`} />
      </View>
    </View>
  );
}

function MinimizedPill({ percent }: { percent: number }) {
  return (
    <View
      backgroundColor={BIZLINK_COLORS.card}
      borderRadius={999}
      paddingHorizontal={14}
      minHeight={44}
      flexDirection="row"
      alignItems="center"
      gap={6}
      style={styles.shadow}
    >
      <CloudUpload size={16} color={BIZLINK_COLORS.brand} strokeWidth={1.75} />
      <Text fontSize={12} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.text}>
        {percent}%
      </Text>
    </View>
  );
}

export function SyncUploadProgressCard() {
  const insets = useSafeAreaInsets();
  const modeRef = useRef<CardMode>('expanded');
  const [mode, setMode] = useState<CardMode>('expanded');
  const dragFollowY = useRef(new Animated.Value(0)).current;

  const resetToExpanded = useCallback(() => {
    modeRef.current = 'expanded';
    setMode('expanded');
  }, []);

  const { phase, progress } = usePushProgressPhase(resetToExpanded);

  const settleDrag = useCallback(() => {
    Animated.spring(dragFollowY, { toValue: 0, friction: 9, useNativeDriver: false }).start();
  }, [dragFollowY]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_evt, gesture) => Math.abs(gesture.dy) > 4,
      onPanResponderMove: (_evt, gesture) => {
        const clamped = Math.max(-DRAG_FOLLOW_CLAMP, Math.min(DRAG_FOLLOW_CLAMP, gesture.dy));
        dragFollowY.setValue(clamped);
      },
      onPanResponderRelease: (_evt, gesture) => {
        const startedExpanded = modeRef.current === 'expanded';
        const draggedUpPastThreshold = gesture.dy < -DRAG_THRESHOLD;
        const draggedDownPastThreshold = gesture.dy > DRAG_THRESHOLD;
        const nextMode: CardMode =
          (startedExpanded && draggedUpPastThreshold) ? 'minimized' :
          (!startedExpanded && draggedDownPastThreshold) ? 'expanded' :
          modeRef.current;
        modeRef.current = nextMode;
        setMode(nextMode);
        settleDrag();
      },
    })
  ).current;

  if (phase === 'idle') return null;

  const percent = getSyncProgressPercent(progress);
  const label = phase === 'done' ? 'Done' : `Uploading... ${percent}%`;

  return (
    <Animated.View
      {...panResponder.panHandlers}
      style={[styles.container, { top: insets.top + 8, transform: [{ translateY: dragFollowY }] }]}
    >
      {mode === 'expanded' ? (
        <ExpandedCard label={label} percent={phase === 'done' ? 100 : percent} />
      ) : (
        <MinimizedPill percent={phase === 'done' ? 100 : percent} />
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 50,
  },
  shadow: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 4,
  },
});
