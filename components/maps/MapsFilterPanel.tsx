import { Text, XStack, YStack } from 'tamagui';
import { BizChip } from '../bizlink/BizChip';
import { BizFilterSheetRow } from '../bizlink/BizFilterSheetRow';
import { DateRangeFilterRow } from '../bizlink/DateRangeFilterRow';
import type { DateRange } from '../bizlink/DateRangePickerModal';
import type { BizFilterOption } from '../bizlink/BizFilterScroll';
import { useBizlinkColors, BIZLINK_FONTS } from '../../lib/theme';
import type { MeetingTypeFilterValue, MeetingStatusFilterValue } from '../../lib/use-maps-screen';

export type MapsDatePreset = 'today' | 'last7' | 'last30' | 'custom';

/**
 * Maps screen's Filters sheet body (Wireframe-Sales-BizLink.html `a-maps`,
 * 2026-08-08 filter-UI rollout). Mirrors components/meetings/
 * MeetingFilterPanel.tsx's accordion-row shape. "Date" keeps the existing
 * preset chips + custom-range picker exactly as they worked before this
 * rollout, just grouped under one BizFilterSheetRow instead of always-visible
 * rows. "Meeting Type"/"Meeting Status" convert the two hand-rolled Pressable
 * chip rows to BizChip in a flexWrap XStack, matching every other rolled-out
 * page — every option visible without swiping.
 */
export function MapsFilterPanel({
  datePreset,
  onDatePresetChange,
  dateRange,
  onDateRangeApply,
  datePresetOptions,
  meetingTypeFilter,
  onMeetingTypeChange,
  meetingTypeOptions,
  meetingStatusFilter,
  onMeetingStatusChange,
  meetingStatusOptions,
}: {
  datePreset: MapsDatePreset;
  onDatePresetChange: (value: MapsDatePreset) => void;
  dateRange: DateRange;
  onDateRangeApply: (range: DateRange | null) => void;
  datePresetOptions: BizFilterOption<MapsDatePreset>[];
  meetingTypeFilter: MeetingTypeFilterValue;
  onMeetingTypeChange: (value: MeetingTypeFilterValue) => void;
  meetingTypeOptions: BizFilterOption<MeetingTypeFilterValue>[];
  meetingStatusFilter: MeetingStatusFilterValue;
  onMeetingStatusChange: (value: MeetingStatusFilterValue) => void;
  meetingStatusOptions: BizFilterOption<MeetingStatusFilterValue>[];
}) {
  const BIZLINK_COLORS = useBizlinkColors();
  const presetLabel = datePresetOptions.find((option) => option.value === datePreset)?.label ?? datePreset;
  const typeLabel = meetingTypeOptions.find((option) => option.value === meetingTypeFilter)?.label ?? meetingTypeFilter;
  const statusLabel = meetingStatusOptions.find((option) => option.value === meetingStatusFilter)?.label ?? meetingStatusFilter;

  return (
    <YStack>
      <BizFilterSheetRow label="Date" value={presetLabel}>
        <YStack gap="$2">
          <XStack gap="$2" flexWrap="wrap">
            {datePresetOptions.map((option) => (
              <BizChip
                key={option.value}
                label={option.label}
                selected={datePreset === option.value}
                onPress={() => onDatePresetChange(option.value)}
              />
            ))}
          </XStack>
          {datePreset === 'custom' ? (
            <YStack>
              <Text fontSize={12} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted} marginBottom={4}>
                Custom range
              </Text>
              <DateRangeFilterRow range={dateRange} onApply={onDateRangeApply} />
            </YStack>
          ) : null}
        </YStack>
      </BizFilterSheetRow>

      <BizFilterSheetRow label="Meeting Type" value={typeLabel}>
        <XStack gap="$2" flexWrap="wrap">
          {meetingTypeOptions.map((option) => (
            <BizChip
              key={option.value}
              label={option.label}
              selected={meetingTypeFilter === option.value}
              onPress={() => onMeetingTypeChange(option.value)}
            />
          ))}
        </XStack>
      </BizFilterSheetRow>

      <BizFilterSheetRow label="Meeting Status" value={statusLabel}>
        <XStack gap="$2" flexWrap="wrap">
          {meetingStatusOptions.map((option) => (
            <BizChip
              key={option.value}
              label={option.label}
              selected={meetingStatusFilter === option.value}
              onPress={() => onMeetingStatusChange(option.value)}
            />
          ))}
        </XStack>
      </BizFilterSheetRow>
    </YStack>
  );
}
