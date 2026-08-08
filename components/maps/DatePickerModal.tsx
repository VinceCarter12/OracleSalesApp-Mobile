import { useState } from 'react';
import { Modal, Pressable, ScrollView } from 'react-native';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { Text, View, XStack, YStack } from 'tamagui';
import { useBizlinkColors, BIZLINK_FONTS } from '../../lib/theme';

interface DatePickerModalProps {
  visible: boolean;
  selectedDate: Date;
  onSelectDate: (date: Date) => void;
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

/**
 * Calendar date picker modal matching Image 3 design - month/year dropdowns,
 * week grid, orange highlights for Sundays and selected date, Confirm button.
 */
export function DatePickerModal({ visible, selectedDate, onSelectDate, onClose }: DatePickerModalProps) {
  const BIZLINK_COLORS = useBizlinkColors();
  const [viewYear, setViewYear] = useState(selectedDate.getFullYear());
  const [viewMonth, setViewMonth] = useState(selectedDate.getMonth());
  const [tempSelectedDate, setTempSelectedDate] = useState(selectedDate);

  const daysInMonth = getDaysInMonth(viewYear, viewMonth);
  const firstDay = getFirstDayOfMonth(viewYear, viewMonth);
  const today = new Date();

  function handleConfirm() {
    onSelectDate(tempSelectedDate);
    onClose();
  }

  function handleDayPress(day: number) {
    setTempSelectedDate(new Date(viewYear, viewMonth, day));
  }

  function prevMonth() {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear(viewYear - 1);
    } else {
      setViewMonth(viewMonth - 1);
    }
  }

  function nextMonth() {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear(viewYear + 1);
    } else {
      setViewMonth(viewMonth + 1);
    }
  }

  const days: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) {
    const prevMonthDays = getDaysInMonth(viewYear, viewMonth === 0 ? 11 : viewMonth - 1);
    days.push(prevMonthDays - firstDay + i + 1);
  }
  for (let i = 1; i <= daysInMonth; i++) {
    days.push(i);
  }
  const remainingCells = 42 - days.length;
  for (let i = 1; i <= remainingCells; i++) {
    days.push(i);
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' }} onPress={onClose}>
        <Pressable onPress={(e) => e.stopPropagation()}>
          <YStack backgroundColor={BIZLINK_COLORS.card} borderRadius={32} padding={24} width={360} maxWidth="90%">
            <Text fontSize={24} fontFamily={BIZLINK_FONTS.semibold} color={BIZLINK_COLORS.text} marginBottom="$3">
              Select Date
            </Text>

            {/* Month/Year Navigation */}
            <XStack alignItems="center" justifyContent="space-between" marginBottom="$3">
              <Pressable onPress={prevMonth} hitSlop={8}>
                <View width={36} height={36} alignItems="center" justifyContent="center">
                  <ChevronLeft size={20} color={BIZLINK_COLORS.text} strokeWidth={2} />
                </View>
              </Pressable>
              <XStack gap="$2">
                <View backgroundColor={BIZLINK_COLORS.soft} borderRadius={12} paddingHorizontal={16} paddingVertical={8}>
                  <Text fontSize={15} fontFamily={BIZLINK_FONTS.semibold} color={BIZLINK_COLORS.text}>
                    {MONTHS[viewMonth]}
                  </Text>
                </View>
                <View backgroundColor={BIZLINK_COLORS.soft} borderRadius={12} paddingHorizontal={16} paddingVertical={8}>
                  <Text fontSize={15} fontFamily={BIZLINK_FONTS.semibold} color={BIZLINK_COLORS.text}>
                    {viewYear}
                  </Text>
                </View>
              </XStack>
              <Pressable onPress={nextMonth} hitSlop={8}>
                <View width={36} height={36} alignItems="center" justifyContent="center">
                  <ChevronRight size={20} color={BIZLINK_COLORS.text} strokeWidth={2} />
                </View>
              </Pressable>
            </XStack>

            {/* Days Header */}
            <XStack marginBottom="$2">
              {DAYS.map((day, idx) => (
                <View key={day} flex={1} alignItems="center">
                  <Text fontSize={11} fontFamily={BIZLINK_FONTS.semibold} color={idx === 0 ? BIZLINK_COLORS.orange : BIZLINK_COLORS.muted}>
                    {day}
                  </Text>
                </View>
              ))}
            </XStack>

            {/* Calendar Grid */}
            <YStack gap={4}>
              {[0, 1, 2, 3, 4, 5].map((week) => (
                <XStack key={week} gap={4}>
                  {[0, 1, 2, 3, 4, 5, 6].map((dayIdx) => {
                    const cellIdx = week * 7 + dayIdx;
                    const day = days[cellIdx];
                    const isCurrentMonth = cellIdx >= firstDay && cellIdx < firstDay + daysInMonth;
                    const cellDate = isCurrentMonth ? new Date(viewYear, viewMonth, day as number) : null;
                    const isSelected = cellDate && tempSelectedDate.toDateString() === cellDate.toDateString();
                    const isSunday = dayIdx === 0;
                    const isToday = cellDate && cellDate.toDateString() === today.toDateString();

                    return (
                      <Pressable
                        key={dayIdx}
                        onPress={() => isCurrentMonth && day && handleDayPress(day as number)}
                        disabled={!isCurrentMonth}
                        style={{ flex: 1, aspectRatio: 1, alignItems: 'center', justifyContent: 'center' }}
                      >
                        <View
                          width="100%"
                          height="100%"
                          alignItems="center"
                          justifyContent="center"
                          backgroundColor={isSelected ? BIZLINK_COLORS.brand : 'transparent'}
                          borderRadius={8}
                          borderWidth={isToday ? 2 : 0}
                          borderColor={BIZLINK_COLORS.brand}
                        >
                          <Text
                            fontSize={14}
                            fontFamily={BIZLINK_FONTS.semibold}
                            color={
                              isSelected
                                ? '#FFFFFF'
                                : !isCurrentMonth
                                ? BIZLINK_COLORS.soft
                                : isSunday
                                ? BIZLINK_COLORS.orange
                                : BIZLINK_COLORS.text
                            }
                          >
                            {day}
                          </Text>
                        </View>
                      </Pressable>
                    );
                  })}
                </XStack>
              ))}
            </YStack>

            {/* Confirm Button */}
            <Pressable onPress={handleConfirm} style={{ marginTop: 20 }}>
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
