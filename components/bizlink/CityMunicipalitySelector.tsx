import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, TextInput } from 'react-native';
import { Check, Search } from 'lucide-react-native';
import { Text, View, XStack, YStack } from 'tamagui';
import { useBizlinkColors, BIZLINK_FONTS, BIZLINK_ON_INK } from '../../lib/theme';
import { getSuggestedPsgcLocalities, searchPsgcLocalities } from '../../lib/psgc-locality-search';
import type { PsgcLocality } from '../../lib/data/psgc-localities';

interface CityMunicipalitySelectorProps {
  value: PsgcLocality | null;
  onSelect: (locality: PsgcLocality) => void;
}

const RESULTS_DEBOUNCE_MS = 220;
const BLUR_COLLAPSE_DELAY_MS = 150;
const MIN_TOUCH_TARGET = 44;
// ~4 rows visible before scrolling — keeps the dropdown from pushing the
// Create button off-screen when a broad query returns the full 10-row cap.
const RESULTS_MAX_HEIGHT = 4 * MIN_TOUCH_TARGET + 4 * 18;

/**
 * ADR-055: wireframe `a-citySearch`/`a-cityOptions`/`a-citySelected`
 * (`Wireframe-Sales-BizLink.html#a-createclient`) — canonical-only PSGC
 * city/municipality picker. Free text is never accepted as a value; only a
 * tap on a result row calls `onSelect`. Input chrome matches `BizField`
 * (52px height, 16px radius, card/line border) so it sits natively among the
 * other Create Client fields.
 *
 * Deviation from the wireframe (approved, not an oversight): the
 * wireframe's `aSearchCities` shows its full mock list on focus even with an
 * empty query. This component intentionally shows nothing until the user
 * types, because the real dataset is 1,656 rows vs. the wireframe's ~7 mock
 * rows — showing all 1,656 on focus would be useless/overwhelming.
 */
export function CityMunicipalitySelector({ value, onSelect }: CityMunicipalitySelectorProps) {
  const BIZLINK_COLORS = useBizlinkColors();
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [editing, setEditing] = useState(false);
  const justSelectedRef = useRef(false);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), RESULTS_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [query]);

  const isSearching = debouncedQuery.trim().length > 0;
  const showResults = editing;
  const results = isSearching ? searchPsgcLocalities(debouncedQuery) : getSuggestedPsgcLocalities();

  function handleChangeText(text: string): void {
    setQuery(text);
    setEditing(true);
  }

  function handleSelectRow(locality: PsgcLocality): void {
    justSelectedRef.current = true;
    onSelect(locality);
    setQuery('');
    setDebouncedQuery('');
    setEditing(false);
  }

  function handleEditSelected(): void {
    setQuery('');
    setDebouncedQuery('');
    setEditing(true);
  }

  function handleBlur(): void {
    // A tap on a result row blurs the TextInput before its onPress fires
    // (standard RN touch-then-blur ordering). Delay the collapse so
    // handleSelectRow has a chance to run and flip justSelectedRef first —
    // otherwise a real row tap would get wiped out by this same collapse.
    setTimeout(() => {
      if (justSelectedRef.current) {
        justSelectedRef.current = false;
        return;
      }
      // Only fall back to the collapsed chip view if there's an existing
      // selection to fall back TO. Blur fires on every keyboard dismissal —
      // including the user just closing the keyboard to scroll the results
      // list with their thumb — not just on "give up and leave the field."
      // Wiping the in-progress search here (when nothing is selected yet)
      // was the reported "auto out" bug: the whole results list vanished
      // the instant the keyboard closed, before the user could tap a row.
      if (value) {
        setEditing(false);
        setQuery('');
        setDebouncedQuery('');
      }
    }, BLUR_COLLAPSE_DELAY_MS);
  }

  if (value && !editing) {
    return (
      <Pressable onPress={handleEditSelected}>
        <XStack
          alignItems="center"
          justifyContent="space-between"
          backgroundColor={BIZLINK_COLORS.tintA}
          borderRadius={14}
          paddingHorizontal={13}
          paddingVertical={11}
          minHeight={MIN_TOUCH_TARGET}
        >
          <Text fontSize={12.5} fontFamily={BIZLINK_FONTS.semibold} color={BIZLINK_COLORS.ink} flex={1}>
            {value.name}, {value.province}
          </Text>
          <Check size={16} color={BIZLINK_COLORS.ink} strokeWidth={2.5} />
        </XStack>
      </Pressable>
    );
  }

  return (
    <YStack>
      <TextInput
        value={query}
        onChangeText={handleChangeText}
        onFocus={() => setEditing(true)}
        onBlur={handleBlur}
        placeholder="Search or choose a city..."
        placeholderTextColor={BIZLINK_COLORS.muted}
        autoCapitalize="words"
        autoCorrect={false}
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
      {showResults ? (
        <View
          backgroundColor={BIZLINK_COLORS.card}
          borderRadius={16}
          padding={6}
          marginTop={6}
          maxHeight={RESULTS_MAX_HEIGHT}
          shadowColor="#12271C"
          shadowOpacity={0.12}
          shadowRadius={12}
          shadowOffset={{ width: 0, height: 6 }}
        >
          <XStack alignItems="center" gap="$1.5" paddingHorizontal={12} paddingTop={7} paddingBottom={5}>
            <Search size={14} color={BIZLINK_COLORS.muted} strokeWidth={2} />
            <Text fontSize={11.5} fontFamily={BIZLINK_FONTS.semibold} color={BIZLINK_COLORS.muted}>
              {isSearching ? 'Search results' : 'Suggested cities / municipalities'}
            </Text>
          </XStack>
          {results.length === 0 ? (
            <Text
              fontSize={12.5}
              fontFamily={BIZLINK_FONTS.medium}
              color={BIZLINK_COLORS.muted}
              paddingHorizontal={12}
              paddingVertical={11}
            >
              No city/municipality found. Try a city, municipality, or province.
            </Text>
          ) : (
            <ScrollView
              nestedScrollEnabled
              keyboardShouldPersistTaps="always"
              showsVerticalScrollIndicator={results.length > 4}
            >
              {results.map((locality) => (
                <Pressable key={locality.code} onPress={() => handleSelectRow(locality)}>
                  <YStack paddingHorizontal={12} paddingVertical={11} borderRadius={12} minHeight={MIN_TOUCH_TARGET} justifyContent="center">
                    <Text fontSize={13} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.text}>
                      {locality.name}
                    </Text>
                    <Text fontSize={11} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted}>
                      {locality.province}
                    </Text>
                  </YStack>
                </Pressable>
              ))}
            </ScrollView>
          )}
        </View>
      ) : null}
    </YStack>
  );
}
