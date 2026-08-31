import { Pressable } from 'react-native';
import { CheckCheck, X } from 'lucide-react-native';
import { Text, View, XStack, YStack } from 'tamagui';
import { useBizlinkColors, BIZLINK_FONTS } from '../../lib/theme';
import { BizButton } from './BizButton';

interface BizSelectionBarProps {
  /** How many rows are ticked. */
  count: number;
  /** Whose queue the batch belongs to — the "one agent at a time" rule made visible. */
  requesterName: string;
  /** Total approvable rows from that same agent across every page; hides "Select all" once reached. */
  eligibleCount: number;
  onSelectAll: () => void;
  onClear: () => void;
  onConfirm: () => void;
  /** Label for the confirm button, e.g. `Approve 7`. */
  confirmLabel: string;
  /** True while the batch is in flight — everything locks, and the label swaps to `busyLabel`. */
  busy?: boolean;
  busyLabel?: string;
  disabled?: boolean;
  /** Shown under the actions when the batch can't run — offline, mainly. */
  helperText?: string | null;
  /** Distance from the screen bottom, e.g. `insets.bottom + 16` — same contract as BizFloatingPager. */
  bottomOffset: number;
  /**
   * Reports this bar's rendered height so the caller can lift the pager and
   * pad the list by the real value.
   *
   * Measured rather than assumed: the bar's height moves with its own content
   * (the "Select all" pill appears and disappears, the offline helper line is
   * conditional, and a long agent name wraps), so any constant a caller picks
   * is right for exactly one of those states and silently wrong for the rest.
   * The first version of this screen hardcoded 150, which stopped being true
   * the moment the pill became a button.
   */
  onHeightChange?: (height: number) => void;
}

/**
 * Floating action bar for a multi-select batch, anchored above the bottom
 * safe area. Pulled out as a component for the same reason `BizFloatingPager`
 * was (see its doc comment): absolute-positioned overlays belong in one place
 * rather than being re-implemented per screen. Render it as a sibling AFTER
 * the scrollable list inside a position-default root, and push the pager up by
 * this bar's height so the two never stack on top of each other.
 *
 * Full-width rounded card rather than the pager's pill: this holds a sentence
 * plus two controls, and a pill wide enough for that stops reading as a pill.
 */
export function BizSelectionBar({
  count,
  requesterName,
  eligibleCount,
  onSelectAll,
  onClear,
  onConfirm,
  confirmLabel,
  busy = false,
  busyLabel,
  disabled = false,
  helperText,
  bottomOffset,
  onHeightChange,
}: BizSelectionBarProps) {
  const BIZLINK_COLORS = useBizlinkColors();

  return (
    <View position="absolute" bottom={bottomOffset} left={16} right={16} pointerEvents="box-none">
      <YStack
        onLayout={(event) => onHeightChange?.(event.nativeEvent.layout.height)}
        backgroundColor={BIZLINK_COLORS.card}
        borderRadius={24}
        padding={14}
        gap="$2.5"
        style={{
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 3 },
          shadowOpacity: 0.16,
          shadowRadius: 5,
          elevation: 5,
        }}
      >
        <XStack alignItems="center" gap="$2">
          <YStack flex={1} gap="$2">
            <Text fontSize={13} fontFamily={BIZLINK_FONTS.semibold} color={BIZLINK_COLORS.text}>
              {count} selected from {requesterName}
            </Text>
            {/* A bordered pill, not brand-coloured text (Adrian, device test
                2026-08-31: "the user wont know this is clickable"). Coloured
                text alone reads as a caption on a card that is already mostly
                text, and there is no hover on a phone to reveal otherwise —
                so the affordance has to be in the shape. */}
            {count < eligibleCount ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Select all ${eligibleCount}`}
                disabled={busy}
                onPress={onSelectAll}
                hitSlop={6}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  alignSelf: 'flex-start',
                  gap: 6,
                  height: 32,
                  paddingHorizontal: 12,
                  borderRadius: 999,
                  borderWidth: 1,
                  borderColor: BIZLINK_COLORS.brand,
                  backgroundColor: BIZLINK_COLORS.tintA,
                  opacity: busy ? 0.4 : 1,
                }}
              >
                <CheckCheck size={14} color={BIZLINK_COLORS.brand} strokeWidth={2} />
                <Text fontSize={12} fontFamily={BIZLINK_FONTS.semibold} color={BIZLINK_COLORS.brand}>
                  Select all {eligibleCount}
                </Text>
              </Pressable>
            ) : null}
          </YStack>
          <Pressable
            accessibilityLabel="Clear selection"
            disabled={busy}
            onPress={onClear}
            hitSlop={8}
            style={{
              width: 36,
              height: 36,
              borderRadius: 18,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: BIZLINK_COLORS.tintA,
              opacity: busy ? 0.4 : 1,
            }}
          >
            <X size={16} color={BIZLINK_COLORS.muted} strokeWidth={2} />
          </Pressable>
        </XStack>

        <BizButton
          small
          label={busy ? (busyLabel ?? 'Working…') : confirmLabel}
          disabled={busy || disabled}
          onPress={onConfirm}
        />

        {helperText ? (
          <Text fontSize={11.5} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted} textAlign="center">
            {helperText}
          </Text>
        ) : null}
      </YStack>
    </View>
  );
}
