import { type ReactNode, useState } from 'react';
import { Animated, Pressable } from 'react-native';
import { ChevronRight } from 'lucide-react-native';
import { Text, YStack } from 'tamagui';
import { useBizlinkColors, BIZLINK_FONTS } from '../../lib/theme';

interface BizFilterSheetRowProps {
  /** Filter dimension name, e.g. "Location", "Agenda", "Sort". */
  label: string;
  /** Current-selection display text, e.g. "All locations", "Newest". */
  value: string;
  /** The existing BizChip horizontal option list for this dimension. */
  children: ReactNode;
}

/**
 * One row of `BizFilterSheet` — iOS-Reminders-style grouped row (label left,
 * current value + chevron right), expands in place (accordion) to reveal
 * `children` (an existing BizChip scroll row) when tapped. Design-only per
 * .claude/rules/50-wireframe-redesign.md — filter state/logic lives entirely
 * in the caller; this only decides what's visible.
 */
export function BizFilterSheetRow({ label, value, children }: BizFilterSheetRowProps) {
  const BIZLINK_COLORS = useBizlinkColors();
  // Open by default (Vince, 2026-08-08) — filter options should be visible
  // without an extra tap; the row header still doubles as a collapse toggle.
  const [expanded, setExpanded] = useState(true);
  const [rotation] = useState(() => new Animated.Value(1));

  function toggle(): void {
    const next = !expanded;
    setExpanded(next);
    Animated.timing(rotation, {
      toValue: next ? 1 : 0,
      duration: 180,
      useNativeDriver: true,
    }).start();
  }

  const rotate = rotation.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '90deg'] });

  return (
    <YStack borderBottomWidth={1} borderBottomColor={BIZLINK_COLORS.line}>
      <Pressable
        onPress={toggle}
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        style={{ flexDirection: 'row', alignItems: 'center', minHeight: 52, paddingVertical: 8 }}
      >
        <Text flex={1} fontSize={13.5} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.text}>
          {label}
        </Text>
        <Text fontSize={13} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted} marginRight={6}>
          {value}
        </Text>
        <Animated.View style={{ transform: [{ rotate }] }}>
          <ChevronRight size={16} color={BIZLINK_COLORS.muted} strokeWidth={1.75} />
        </Animated.View>
      </Pressable>
      {expanded ? <YStack paddingBottom={14}>{children}</YStack> : null}
    </YStack>
  );
}
