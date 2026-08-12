import { useState } from 'react';
import { ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Building2, CalendarDays, Camera, History, Hourglass, LogIn, MapPin } from 'lucide-react-native';
import { Text, View, XStack, YStack } from 'tamagui';
import { useBizlinkColors, BIZLINK_FONTS, BIZLINK_ON_INK } from '../../../lib/theme';
import { showToast } from '../../../lib/toast';
import { BizTopBar } from '../../../components/bizlink/BizTopBar';
import { BizSectionHeader } from '../../../components/bizlink/BizSectionHeader';
import { BizChip } from '../../../components/bizlink/BizChip';

const WEEK_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

type ClockMode = 'office' | 'event';

const PREVIEW_TOAST_MESSAGE = 'This page is under construction. There is no working function here yet — please wait for a future app update.';

/**
 * Wireframe `id="a-clockinout"` (F-006, ~line 942) — UI concept only per
 * client request 2026-07-14, adapted from a habit-tracker reference (dark
 * weekly overview + streak/consistency). F-006 itself is explicitly
 * UNSPEC'D (Sprint.md, Features.md#F-006): office = GPS-verified, event =
 * photo + GPS + event name, but "kailangan pa rin ng full spec" per the
 * June 24 meeting. This screen therefore stays display-only — the week
 * grid, streak, and consistency values are NOT sourced from any real
 * attendance record (none exists yet), so they render as placeholders
 * rather than fabricated numbers; the Mode toggle is local-only UI state
 * (mirrors the wireframe's own `aSetClockMode()`, which is equally
 * non-persisted); GPS/date-time auto-capture rows show "hindi pa
 * available" instead of fake captured values; Clock in/out and History
 * make no completion claim, matching the wireframe's own
 * `aToast('Preview lang ang screen na ito — wala pang function')`.
 */
export default function ClockInOutScreen() {
  const insets = useSafeAreaInsets();
  const BIZLINK_COLORS = useBizlinkColors();
  const [mode, setMode] = useState<ClockMode>('office');

  return (
    <YStack flex={1} backgroundColor={BIZLINK_COLORS.canvas} paddingTop={insets.top}>
      <BizTopBar title="Clock In/Out" fallbackHref="/(tabs)" />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}>
        <XStack
          alignItems="flex-start"
          gap="$2.5"
          backgroundColor={BIZLINK_COLORS.amberSoft}
          borderRadius={20}
          padding={14}
          marginBottom={14}
        >
          <Hourglass size={16} color={BIZLINK_COLORS.orange} strokeWidth={1.75} />
          <Text flex={1} fontSize={12} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.orange} lineHeight={17}>
            This page is just a preview. Nothing here is final yet. The real clock in/out working
            feature is still being planned for a future app update.
          </Text>
        </XStack>

        <YStack backgroundColor={BIZLINK_COLORS.ink} borderRadius={24} padding={18}>
          <View
            backgroundColor={BIZLINK_ON_INK.circleFill}
            borderRadius={999}
            paddingHorizontal={11}
            paddingVertical={4}
            alignSelf="flex-start"
          >
            <Text fontSize={10.5} fontFamily={BIZLINK_FONTS.semibold} color={BIZLINK_ON_INK.solid}>
              This week
            </Text>
          </View>
          <XStack justifyContent="space-between" marginTop={14}>
            {WEEK_LABELS.map((label) => (
              <YStack key={label} alignItems="center" gap="$1">
                <View
                  width={28}
                  height={28}
                  borderRadius={14}
                  backgroundColor={BIZLINK_ON_INK.circleFill}
                  alignItems="center"
                  justifyContent="center"
                >
                  <Text fontSize={11} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_ON_INK.textMuted}>–</Text>
                </View>
                <Text fontSize={10} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_ON_INK.textMuted}>{label}</Text>
              </YStack>
            ))}
          </XStack>
          <XStack gap="$2.5" marginTop={16}>
            <YStack flex={1} backgroundColor={BIZLINK_ON_INK.circleFill} borderRadius={16} padding={12}>
              <Text fontSize={10} fontFamily={BIZLINK_FONTS.semibold} color={BIZLINK_ON_INK.textMuted}>CURRENT STREAK</Text>
              <Text fontSize={20} fontFamily={BIZLINK_FONTS.semibold} color={BIZLINK_ON_INK.solid} marginTop={4}>
                — <Text fontSize={12} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_ON_INK.textMuted}>no records yet</Text>
              </Text>
            </YStack>
            <YStack flex={1} backgroundColor={BIZLINK_ON_INK.circleFill} borderRadius={16} padding={12}>
              <Text fontSize={10} fontFamily={BIZLINK_FONTS.semibold} color={BIZLINK_ON_INK.textMuted}>CONSISTENCY</Text>
              <Text fontSize={20} fontFamily={BIZLINK_FONTS.semibold} color={BIZLINK_ON_INK.solid} marginTop={4}>
                — <Text fontSize={12} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_ON_INK.textMuted}>no records yet</Text>
              </Text>
            </YStack>
          </XStack>
        </YStack>

        <BizSectionHeader title="Mode" />
        <XStack gap="$2">
          <View flex={1}>
            <BizChip
              label="Office"
              selected={mode === 'office'}
              onPress={() => setMode('office')}
              fullWidth
              icon={<Building2 size={14} color={mode === 'office' ? BIZLINK_ON_INK.solid : BIZLINK_COLORS.muted} strokeWidth={1.75} />}
            />
          </View>
          <View flex={1}>
            <BizChip
              label="Event"
              selected={mode === 'event'}
              onPress={() => setMode('event')}
              fullWidth
              icon={<CalendarDays size={14} color={mode === 'event' ? BIZLINK_ON_INK.solid : BIZLINK_COLORS.muted} strokeWidth={1.75} />}
            />
          </View>
        </XStack>
        <XStack alignItems="flex-start" gap="$1.5" marginTop={8}>
          <MapPin size={13} color={BIZLINK_COLORS.muted} strokeWidth={1.75} />
          <Text flex={1} fontSize={12} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted} lineHeight={17}>
            {mode === 'office'
              ? 'Office — the app checks your location; no photo needed.'
              : 'Event — you take a photo, the app uses your location, and you add the event name.'}
          </Text>
        </XStack>

        <Text fontSize={11} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted} letterSpacing={0.4} marginTop={16} marginBottom={8}>
          AUTO-CAPTURED
        </Text>
        <YStack backgroundColor={BIZLINK_COLORS.card} borderRadius={20} padding={16} gap="$2.5">
          <XStack alignItems="center" gap="$2">
            <MapPin size={15} color={BIZLINK_COLORS.muted} strokeWidth={1.75} />
            <Text fontSize={13} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted}>Location — not available yet</Text>
          </XStack>
          <XStack alignItems="center" gap="$2">
            <Hourglass size={15} color={BIZLINK_COLORS.muted} strokeWidth={1.75} />
            <Text fontSize={13} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted}>Date & time — not available yet</Text>
          </XStack>
          {mode === 'event' ? (
            <XStack alignItems="center" gap="$2.5">
              <View width={40} height={40} borderRadius={12} backgroundColor={BIZLINK_COLORS.soft} alignItems="center" justifyContent="center">
                <Camera size={17} color={BIZLINK_COLORS.muted} strokeWidth={1.75} />
              </View>
              <YStack flex={1}>
                <Text fontSize={12} fontFamily={BIZLINK_FONTS.semibold} color={BIZLINK_COLORS.text}>Event photo — camera only</Text>
                <Text fontSize={11} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted}>Needed for an Event check-in.</Text>
              </YStack>
            </XStack>
          ) : null}
        </YStack>

        <View
          marginTop={14}
          height={52}
          borderRadius={999}
          backgroundColor={BIZLINK_COLORS.brand}
          alignItems="center"
          justifyContent="center"
          onPress={() => showToast(PREVIEW_TOAST_MESSAGE)}
        >
          <XStack alignItems="center" gap="$2">
            <LogIn size={16} color={BIZLINK_ON_INK.solid} strokeWidth={1.75} />
            <Text fontFamily={BIZLINK_FONTS.semibold} fontSize={15} color={BIZLINK_ON_INK.solid}>Clock in</Text>
          </XStack>
        </View>

        <BizSectionHeader title="History" />
        <YStack alignItems="center" padding="$6" gap="$2.5">
          <History size={36} color={BIZLINK_COLORS.muted} strokeWidth={1.75} />
          <Text fontSize={13} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted} textAlign="center">
            There's no clock history yet. It will appear here once this feature is working.
          </Text>
        </YStack>
      </ScrollView>
    </YStack>
  );
}
