import { useState } from 'react';
import { Pressable } from 'react-native';
import { ChevronRight } from 'lucide-react-native';
import { Text } from 'tamagui';
import { useBizlinkColors, BIZLINK_FONTS } from '../../lib/theme';
import { DateRangePickerModal, type DateRange } from './DateRangePickerModal';

interface DateRangeFilterRowProps {
  range: DateRange | null;
  onApply: (range: DateRange | null) => void;
}

function formatShort(date: Date): string {
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/**
 * "Date range" row for `BizFilterSheet` — unlike the other rows (which
 * expand chip options in place), this opens `DateRangePickerModal` on top of
 * the sheet, matching the Maps screen's calendar-picker pattern (Vince,
 * 2026-08-08) instead of an inline month stepper.
 */
export function DateRangeFilterRow({ range, onApply }: DateRangeFilterRowProps) {
  const BIZLINK_COLORS = useBizlinkColors();
  const [pickerVisible, setPickerVisible] = useState(false);
  const displayValue = range ? `${formatShort(range.start)} – ${formatShort(range.end)}` : 'All days';

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Date range filter"
        onPress={() => setPickerVisible(true)}
        style={{ flexDirection: 'row', alignItems: 'center', minHeight: 52, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: BIZLINK_COLORS.line }}
      >
        <Text flex={1} fontSize={13.5} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.text}>
          Date range
        </Text>
        <Text fontSize={13} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted} marginRight={6}>
          {displayValue}
        </Text>
        <ChevronRight size={16} color={BIZLINK_COLORS.muted} strokeWidth={1.75} />
      </Pressable>

      <DateRangePickerModal
        visible={pickerVisible}
        range={range}
        onApply={onApply}
        onClose={() => setPickerVisible(false)}
      />
    </>
  );
}
