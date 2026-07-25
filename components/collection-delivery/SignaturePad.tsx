import { useRef, useState } from 'react';
import { PanResponder, Pressable, View as RNView } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { Eraser, PenLine } from 'lucide-react-native';
import { Text, XStack } from 'tamagui';
import { useBizlinkColors, BIZLINK_FONTS, COLORS } from '../../lib/theme';

const PAD_HEIGHT = 140;

interface SignaturePadProps {
  /** Fires with true once anything is drawn, false on Clear. */
  onSignedChange: (signed: boolean) => void;
  /** Lets the parent ScrollView disable scrolling while a stroke is in progress. */
  onDrawingChange?: (drawing: boolean) => void;
  hint?: string;
}

/**
 * F-007: wireframe `.sigpad` — the receiver's digital signature drawn on the
 * phone (F-007, 2026-07-16: required for Office remittance). Strokes are
 * captured with PanResponder into SVG paths; first draft keeps them in memory
 * only — exporting/persisting the signature comes with the F-007 schema.
 */
export function SignaturePad({ onSignedChange, onDrawingChange, hint = 'Pumirma dito ang receiving officer' }: SignaturePadProps) {
  const BIZLINK_COLORS = useBizlinkColors();
  const [paths, setPaths] = useState<string[]>([]);
  const [livePath, setLivePath] = useState<string>('');
  const livePathRef = useRef('');

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: (e) => {
        const { locationX, locationY } = e.nativeEvent;
        livePathRef.current = `M${locationX.toFixed(1)} ${locationY.toFixed(1)}`;
        setLivePath(livePathRef.current);
        onDrawingChange?.(true);
      },
      onPanResponderMove: (e) => {
        const { locationX, locationY } = e.nativeEvent;
        livePathRef.current += ` L${locationX.toFixed(1)} ${locationY.toFixed(1)}`;
        setLivePath(livePathRef.current);
      },
      onPanResponderRelease: () => {
        if (livePathRef.current) {
          setPaths((prev) => [...prev, livePathRef.current]);
          onSignedChange(true);
        }
        livePathRef.current = '';
        setLivePath('');
        onDrawingChange?.(false);
      },
    })
  ).current;

  function clear(): void {
    setPaths([]);
    livePathRef.current = '';
    setLivePath('');
    onSignedChange(false);
  }

  const signed = paths.length > 0 || !!livePath;
  return (
    <RNView
      style={{
        backgroundColor: BIZLINK_COLORS.card,
        borderRadius: 20,
        borderWidth: signed ? 0 : 1.5,
        borderColor: COLORS.swanLedge,
        borderStyle: 'dashed',
        marginTop: 8,
        overflow: 'hidden',
      }}
    >
      <RNView style={{ height: PAD_HEIGHT }} {...panResponder.panHandlers}>
        <Svg width="100%" height={PAD_HEIGHT}>
          {[...paths, ...(livePath ? [livePath] : [])].map((d, i) => (
            <Path key={i} d={d} stroke={BIZLINK_COLORS.text} strokeWidth={2} fill="none" strokeLinecap="round" strokeLinejoin="round" />
          ))}
        </Svg>
        {!signed ? (
          <XStack
            position="absolute"
            top={0}
            bottom={0}
            left={0}
            right={0}
            alignItems="center"
            justifyContent="center"
            gap="$1.5"
            pointerEvents="none"
          >
            <PenLine size={14} color={BIZLINK_COLORS.muted} strokeWidth={1.75} />
            <Text fontSize={12.5} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted}>{hint}</Text>
          </XStack>
        ) : null}
      </RNView>
      <Pressable onPress={clear} style={{ position: 'absolute', top: 10, right: 10 }} hitSlop={6}>
        <XStack backgroundColor={BIZLINK_COLORS.soft} borderRadius={999} paddingHorizontal={12} paddingVertical={6} alignItems="center" gap="$1">
          <Eraser size={12} color={BIZLINK_COLORS.muted} strokeWidth={1.75} />
          <Text fontSize={11} fontFamily={BIZLINK_FONTS.semibold} color={BIZLINK_COLORS.muted}>Clear</Text>
        </XStack>
      </Pressable>
    </RNView>
  );
}
