import { Pressable, TextInput } from 'react-native';
import { Search, SlidersHorizontal } from 'lucide-react-native';
import { Text, XStack } from 'tamagui';
import { BIZLINK_COLORS, BIZLINK_FONTS, BIZLINK_ON_INK } from '../../lib/theme';

interface MapsSearchFilterBarProps {
  searchQuery: string;
  onSearchQueryChange: (value: string) => void;
  filterOpen: boolean;
  onToggleFilter: () => void;
  filtersActive: boolean;
}

/**
 * Search box + "Filters" toggle pill, identical across the Sales/RSR and
 * Manager Maps screens (`app/(tabs)/more/maps.tsx`, `app/(manager)/more/maps.tsx`)
 * — extracted 2026-08-16 while wiring the org-wide prospect filter (which
 * pushed both screens over the 300-line file cap) rather than duplicating a
 * third copy for a hypothetical use, and to remove the pre-existing
 * duplication per this repo's reuse-first rule.
 */
export function MapsSearchFilterBar({ searchQuery, onSearchQueryChange, filterOpen, onToggleFilter, filtersActive }: MapsSearchFilterBarProps) {
  const highlighted = filterOpen || filtersActive;

  return (
    <XStack gap="$2" alignItems="center" marginBottom="$3">
      <XStack flex={1} alignItems="center" gap="$2" height={52} paddingHorizontal={12} backgroundColor={BIZLINK_COLORS.card} borderRadius={16}>
        <Search size={17} color={BIZLINK_COLORS.muted} strokeWidth={1.75} />
        <TextInput
          value={searchQuery}
          onChangeText={onSearchQueryChange}
          placeholder="Search office location..."
          placeholderTextColor={BIZLINK_COLORS.muted}
          style={{ flex: 1, color: BIZLINK_COLORS.text, fontFamily: BIZLINK_FONTS.medium, fontSize: 13 }}
        />
      </XStack>
      <Pressable
        accessibilityLabel="Toggle filters"
        onPress={onToggleFilter}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 6,
          backgroundColor: highlighted ? BIZLINK_COLORS.ink : BIZLINK_COLORS.card,
          borderRadius: 16,
          paddingHorizontal: 14,
          height: 52,
          borderWidth: 1,
          borderColor: highlighted ? BIZLINK_COLORS.ink : BIZLINK_COLORS.line,
        }}
      >
        <SlidersHorizontal size={16} color={highlighted ? BIZLINK_ON_INK.solid : BIZLINK_COLORS.muted} strokeWidth={1.75} />
        <Text fontSize={11.5} fontFamily={BIZLINK_FONTS.medium} color={highlighted ? BIZLINK_ON_INK.solid : BIZLINK_COLORS.muted}>
          Filters
        </Text>
      </Pressable>
    </XStack>
  );
}
