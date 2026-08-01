import { forwardRef, useImperativeHandle, useRef, useState } from 'react';
import { PanResponder, Pressable, View as RNView } from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';
import { File, Paths } from 'expo-file-system';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import { Eraser, PenLine } from 'lucide-react-native';
import { Text, XStack } from 'tamagui';
import { useBizlinkColors, BIZLINK_FONTS, COLORS } from '../../lib/theme';
import { uuidv4 } from '../../lib/uuid';

const PAD_HEIGHT = 140;
// The captured signature is a formal proof artifact, so it's rendered on a
// FIXED white background with FIXED dark ink regardless of the app theme — a
// white "paper" signing area reads correctly in both light and dark mode, and
// (crucially) transcoding to JPEG has no transparency to flatten to black.
const SIGNATURE_BG = '#FFFFFF';
const SIGNATURE_INK = '#111827';

export interface SignaturePadProps {
  /** Fires with true once anything is drawn, false on Clear. */
  onSignedChange: (signed: boolean) => void;
  /** Lets the parent ScrollView disable scrolling while a stroke is in progress. */
  onDrawingChange?: (drawing: boolean) => void;
  hint?: string;
}

export interface SignaturePadHandle {
  /**
   * Renders the current strokes to a JPEG file and returns its local URI, or
   * null if nothing was drawn. Called by the parent at submit time — the pad
   * keeps strokes in memory until then. Safe to call repeatedly.
   */
  captureToFile(): Promise<string | null>;
  /** True if anything has been drawn (parents also track this via onSignedChange). */
  isSigned(): boolean;
}

// Dependency-free base64 → bytes: react-native-svg's toDataURL yields base64
// PNG, and expo-file-system's File.write takes a Uint8Array. Avoids relying on
// a global atob (not guaranteed on Hermes) or the legacy FileSystem string API
// (its subpath import breaks Metro — see meeting-photo-service.ts).
const B64_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
function base64ToBytes(base64: string): Uint8Array {
  const clean = base64.replace(/[^A-Za-z0-9+/]/g, '');
  const out = new Uint8Array(Math.floor((clean.length * 3) / 4));
  let p = 0;
  for (let i = 0; i < clean.length; i += 4) {
    const c1 = B64_CHARS.indexOf(clean[i]);
    const c2 = B64_CHARS.indexOf(clean[i + 1]);
    const c3 = i + 2 < clean.length ? B64_CHARS.indexOf(clean[i + 2]) : -1;
    const c4 = i + 3 < clean.length ? B64_CHARS.indexOf(clean[i + 3]) : -1;
    out[p++] = (c1 << 2) | (c2 >> 4);
    if (c3 >= 0) out[p++] = ((c2 & 15) << 4) | (c3 >> 2);
    if (c4 >= 0) out[p++] = ((c3 & 3) << 6) | c4;
  }
  return out.subarray(0, p);
}

/** react-native-svg's Svg ref exposes toDataURL(cb) but it isn't on the exported prop type — narrow to just what's called. */
interface SvgSnapshotRef {
  toDataURL: (callback: (base64: string) => void, options?: { width?: number; height?: number }) => void;
}

/**
 * F-007: wireframe `.sigpad` — the receiver's digital signature drawn on the
 * phone. Strokes are captured with PanResponder into SVG paths; the parent
 * grabs a JPEG of them at submit time via the imperative `captureToFile()`
 * handle (F-007 Phase 2b, 2026-07-29 — previously the strokes were discarded
 * and only a boolean was reported).
 */
export const SignaturePad = forwardRef<SignaturePadHandle, SignaturePadProps>(function SignaturePad(
  { onSignedChange, onDrawingChange, hint = 'Have the receiving officer sign here' },
  ref
) {
  const BIZLINK_COLORS = useBizlinkColors();
  const [paths, setPaths] = useState<string[]>([]);
  const [livePath, setLivePath] = useState<string>('');
  const livePathRef = useRef('');
  const pathsRef = useRef<string[]>([]);
  const svgRef = useRef<SvgSnapshotRef | null>(null);

  useImperativeHandle(ref, () => ({
    isSigned: () => pathsRef.current.length > 0,
    async captureToFile(): Promise<string | null> {
      const snapshot = svgRef.current;
      if (pathsRef.current.length === 0 || !snapshot) return null;
      const base64Png = await new Promise<string>((resolve, reject) => {
        try {
          snapshot.toDataURL((data) => resolve(data));
        } catch (err) {
          reject(err);
        }
      });
      // Write the PNG, then transcode to JPEG (matches the app's photo lane,
      // which is JPEG-only) — the white Rect below means no transparency issues.
      // react-native-svg returns bare base64, but strip a data-URI prefix
      // defensively (its chars would otherwise corrupt the byte decode).
      const rawBase64 = base64Png.includes(',') ? base64Png.slice(base64Png.indexOf(',') + 1) : base64Png;
      const pngFile = new File(Paths.cache, `sig-${uuidv4()}.png`);
      if (pngFile.exists) pngFile.delete();
      pngFile.create();
      pngFile.write(base64ToBytes(rawBase64));
      const jpeg = await manipulateAsync(pngFile.uri, [], { compress: 0.85, format: SaveFormat.JPEG });
      try {
        pngFile.delete();
      } catch {
        // A leftover temp PNG in the cache dir is harmless — OS evicts it.
      }
      return jpeg.uri;
    },
  }));

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
          const next = [...pathsRef.current, livePathRef.current];
          pathsRef.current = next;
          setPaths(next);
          onSignedChange(true);
        }
        livePathRef.current = '';
        setLivePath('');
        onDrawingChange?.(false);
      },
    })
  ).current;

  function clear(): void {
    pathsRef.current = [];
    setPaths([]);
    livePathRef.current = '';
    setLivePath('');
    onSignedChange(false);
  }

  const signed = paths.length > 0 || !!livePath;
  return (
    <RNView
      style={{
        backgroundColor: SIGNATURE_BG,
        borderRadius: 20,
        borderWidth: signed ? 0 : 1.5,
        borderColor: COLORS.swanLedge,
        borderStyle: 'dashed',
        marginTop: 8,
        overflow: 'hidden',
      }}
    >
      <RNView style={{ height: PAD_HEIGHT }} {...panResponder.panHandlers}>
        <Svg ref={svgRef as never} width="100%" height={PAD_HEIGHT}>
          {/* Solid white base so the captured JPEG has no transparency to flatten. */}
          <Rect x={0} y={0} width="100%" height={PAD_HEIGHT} fill={SIGNATURE_BG} />
          {[...paths, ...(livePath ? [livePath] : [])].map((d, i) => (
            <Path key={i} d={d} stroke={SIGNATURE_INK} strokeWidth={2} fill="none" strokeLinecap="round" strokeLinejoin="round" />
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
});
