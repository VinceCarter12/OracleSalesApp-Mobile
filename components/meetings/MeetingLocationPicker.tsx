import { TextInput } from 'react-native';
import { TriangleAlert } from 'lucide-react-native';
import { Text, XStack, YStack } from 'tamagui';
import { useBizlinkColors, BIZLINK_FONTS } from '../../lib/theme';
import { OTHER_LOCATION_MAX_LENGTH } from '../../lib/field-validation';
import { BizSectionHeader } from '../bizlink/BizSectionHeader';
import { BizChip } from '../bizlink/BizChip';

// Wireframe-Sales-BizLink.html:688-695 (`#a-recordBody`'s "Meeting location"
// `.seg`) — ONE control with 3 chips (Client Office / Online / Others), not
// a separate mode toggle + a 2-chip location group. `aSetMeetingLocation()`
// (line 1762) derives `mode` from this same selection:
// `aSetMeetingMode(kind==='online'?'online':'in_person')`.
//
// 'Company Office' added per ADR-063 (Vince, 2026-08-19/20): a meeting held
// at our own office, with NO geofence/radius validation — the tag alone,
// visible to the admin on the map, is sufficient. Placed after 'Client
// Office' since both are in-person; `record.tsx`'s existing
// `loc === 'Online' ? 'online' : 'in_person'` mode derivation already covers
// it correctly with no change. Guard (Office-Location-Spec-2026-07-29): only
// an EXACT `'Client Office'` match may capture `clients.office_lat/lng`
// (`lib/meeting-record-assembler.ts`'s `captureOfficePin`) — 'Company
// Office' must never trip that, and does not, since it is a different
// string entirely.
export const MEETING_LOCATIONS = ['Client Office', 'Company Office', 'Online', 'Others'] as const;
export type MeetingLocationOption = (typeof MEETING_LOCATIONS)[number];

interface MeetingLocationPickerProps {
  value: MeetingLocationOption;
  onChange: (value: MeetingLocationOption) => void;
  otherLocation: string;
  onOtherLocationChange: (value: string) => void;
}

/**
 * record.tsx's "Meeting location" section (Meeting-Flow Wireframe Parity
 * Audit 2026-08-03 item 4: relocated ABOVE the Start button, matching
 * Wireframe-Sales-BizLink.html's `#a-recordBody` order exactly) — extracted
 * so record.tsx (already near the 300-line file cap) stays under it.
 */
export function MeetingLocationPicker({ value, onChange, otherLocation, onOtherLocationChange }: MeetingLocationPickerProps) {
  const BIZLINK_COLORS = useBizlinkColors();
  return (
    <>
      <BizSectionHeader title="Meeting location" />
      <XStack gap="$2" flexWrap="wrap">
        {MEETING_LOCATIONS.map((loc) => (
          <BizChip key={loc} label={loc} selected={value === loc} onPress={() => onChange(loc)} />
        ))}
      </XStack>
      {value === 'Online' ? (
        <XStack gap="$1.5" alignItems="flex-start" marginTop="$1.5">
          <TriangleAlert size={13} color={BIZLINK_COLORS.orange} strokeWidth={1.75} style={{ marginTop: 2 }} />
          <Text fontSize={11.5} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted} flex={1} lineHeight={16}>
            Online meeting — the location saved is your location, not the client's. It won't count as a
            client-site visit in maps/reports.
          </Text>
        </XStack>
      ) : null}
      {value === 'Others' ? (
        <YStack marginTop="$2">
          <TextInput
            value={otherLocation}
            onChangeText={onOtherLocationChange}
            placeholder="e.g. Starbucks Alabang"
            placeholderTextColor={BIZLINK_COLORS.muted}
            maxLength={OTHER_LOCATION_MAX_LENGTH}
            style={{
              height: 52,
              borderRadius: 16,
              paddingHorizontal: 16,
              fontFamily: BIZLINK_FONTS.medium,
              fontSize: 14.5,
              color: BIZLINK_COLORS.text,
              backgroundColor: BIZLINK_COLORS.card,
              borderWidth: 1,
              borderColor: BIZLINK_COLORS.line,
            }}
          />
        </YStack>
      ) : null}
    </>
  );
}
