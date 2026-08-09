import { useState } from 'react';
import { Modal, Pressable } from 'react-native';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { Text, View, XStack, YStack } from 'tamagui';
import { useBizlinkColors, BIZLINK_FONTS } from '../../lib/theme';

export interface DateRange {
  start: Date;
  end: Date;
}

interface DateRangePickerModalProps {
  visible: boolean;
  /** `null` means no range is applied — "All days". */
  range: DateRange | null;
  onApply: (range: DateRange | null) => void;
  onClose: () => void;
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const DAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year: number, month: number): number {
  return new Date(year, month, 1).getDay();
}

function startOfDay(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

/**
 * Date-RANGE picker (Vince, 2026-08-08 — "katulad ng nasa filtering ng maps
 * page" plus a range and a clear-all option that Maps' single-date
 * `components/maps/DatePickerModal.tsx` doesn't have). Same visual family:
 * month/year nav, week grid, rounded card modal, Confirm button — extended
 * for a two-tap start/end range selection and a "Select all days" action
 * that clears the filter entirely instead of picking a date.
 */
export function DateRangePickerModal({ visible, range, onApply, onClose }: DateRangePickerModalProps) {
  const BIZLINK_COLORS = useBizlinkColors();
  const initialMonth = range?.start ?? new Date();
  const [viewYear, setViewYear] = useState(initialMonth.getFullYear());
  const [viewMonth, setViewMonth] = useState(initialMonth.getMonth());
  const [tempStart, setTempStart] = useState<Date | null>(range?.start ?? null);
  const [tempEnd, setTempEnd] = useState<Date | null>(range?.end ?? null);

  const daysInMonth = getDaysInMonth(viewYear, viewMonth);
  const firstDay = getFirstDayOfMonth(viewYear, viewMonth);
  const today = new Date();

  function handleDayPress(day: number): void {
    const picked = new Date(viewYear, viewMonth, day);
    if (!tempStart || (tempStart && tempEnd)) {
      setTempStart(picked);
      setTempEnd(null);
      return;
    }
    if (startOfDay(picked) < startOfDay(tempStart)) {
      setTempStart(picked);
      setTempEnd(null);
      return;
    }
    setTempEnd(picked);
  }

  function handleConfirm(): void {
    if (!tempStart) return;
    onApply({ start: tempStart, end: tempEnd ?? tempStart });
    onClose();
  }

  function handleSelectAllDays(): void {
    setTempStart(null);
    setTempEnd(null);
    onApply(null);
    onClose();
  }

  function prevMonth(): void {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(viewYear - 1); } else { setViewMonth(viewMonth - 1); }
  }

  function nextMonth(): void {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(viewYear + 1); } else { setViewMonth(viewMonth + 1); }
  }

  const days: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) days.push(null);
  for (let i = 1; i <= daysInMonth; i++) days.push(i);
  const remainingCells = 42 - days.length;
  for (let i = 0; i < remainingCells; i++) days.push(null);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' }} onPress={onClose}>
        <Pressable onPress={(e) => e.stopPropagation()}>
          <YStack backgroundColor={BIZLINK_COLORS.card} borderRadius={32} padding={24} width={360} maxWidth="90%">
            <Text fontSize={20} fontFamily={BIZLINK_FONTS.semibold} color={BIZLINK_COLORS.text} marginBottom="$1">
              Select Date Range
            </Text>
            <Text fontSize={12.5} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted} marginBottom="$3">
              {tempStart ? `${tempStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${(tempEnd ?? tempStart).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}` : 'Tap a start date, then an end date'}
            </Text>

            <XStack alignItems="center" justifyContent="space-between" marginBottom="$3">
              <Pressable accessibilityLabel="Previous month" onPress={prevMonth} hitSlop={8}>
                <View width={36} height={36} alignItems="center" justifyContent="center">
                  <ChevronLeft size={20} color={BIZLINK_COLORS.text} strokeWidth={2} />
                </View>
              </Pressable>
              <Text fontSize={15} fontFamily={BIZLINK_FONTS.semibold} color={BIZLINK_COLORS.text}>
                {MONTHS[viewMonth]} {viewYear}
              </Text>
              <Pressable accessibilityLabel="Next month" onPress={nextMonth} hitSlop={8}>
                <View width={36} height={36} alignItems="center" justifyContent="center">
                  <ChevronRight size={20} color={BIZLINK_COLORS.text} strokeWidth={2} />
                </View>
              </Pressable>
            </XStack>

            <XStack marginBottom="$2">
              {DAYS.map((day, idx) => (
                <View key={day} flex={1} alignItems="center">
                  <Text fontSize={11} fontFamily={BIZLINK_FONTS.semibold} color={idx === 0 ? BIZLINK_COLORS.orange : BIZLINK_COLORS.muted}>
                    {day}
                  </Text>
                </View>
              ))}
            </XStack>

            <YStack gap={4}>
              {[0, 1, 2, 3, 4, 5].map((week) => (
                <XStack key={week} gap={4}>
                  {[0, 1, 2, 3, 4, 5, 6].map((dayIdx) => {
                    const cellIdx = week * 7 + dayIdx;
                    const day = days[cellIdx];
                    const cellDate = day ? new Date(viewYear, viewMonth, day) : null;
                    const isStart = cellDate && tempStart && startOfDay(cellDate) === startOfDay(tempStart);
                    const isEnd = cellDate && tempEnd && startOfDay(cellDate) === startOfDay(tempEnd);
                    const isInRange = cellDate && tempStart && tempEnd && startOfDay(cellDate) > startOfDay(tempStart) && startOfDay(cellDate) < startOfDay(tempEnd);
                    const isToday = cellDate && cellDate.toDateString() === today.toDateString();

                    return (
                      <Pressable
                        key={dayIdx}
                        onPress={() => day && handleDayPress(day)}
                        disabled={!day}
                        style={{ flex: 1, aspectRatio: 1, alignItems: 'center', justifyContent: 'center' }}
                      >
                        <View
                          width="100%"
                          height="100%"
                          alignItems="center"
                          justifyContent="center"
                          backgroundColor={isStart || isEnd ? BIZLINK_COLORS.brand : isInRange ? BIZLINK_COLORS.soft : 'transparent'}
                          borderRadius={8}
                          borderWidth={isToday && !isStart && !isEnd ? 2 : 0}
                          borderColor={BIZLINK_COLORS.brand}
                        >
                          <Text
                            fontSize={14}
                            fontFamily={BIZLINK_FONTS.semibold}
                            color={isStart || isEnd ? '#FFFFFF' : !day ? 'transparent' : dayIdx === 0 ? BIZLINK_COLORS.orange : BIZLINK_COLORS.text}
                          >
                            {day ?? ''}
                          </Text>
                        </View>
                      </Pressable>
                    );
                  })}
                </XStack>
              ))}
            </YStack>

            <Pressable onPress={handleSelectAllDays} style={{ marginTop: 18 }}>
              <View backgroundColor={BIZLINK_COLORS.soft} borderRadius={16} paddingVertical={12} alignItems="center">
                <Text fontSize={14} fontFamily={BIZLINK_FONTS.semibold} color={BIZLINK_COLORS.text}>
                  Select All Days
                </Text>
              </View>
            </Pressable>

            <Pressable onPress={handleConfirm} disabled={!tempStart} style={{ marginTop: 10, opacity: tempStart ? 1 : 0.4 }}>
              <View backgroundColor={BIZLINK_COLORS.brand} borderRadius={16} paddingVertical={14} alignItems="center">
                <Text fontSize={16} fontFamily={BIZLINK_FONTS.semibold} color="#FFFFFF">
                  Confirm
                </Text>
              </View>
            </Pressable>
          </YStack>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
