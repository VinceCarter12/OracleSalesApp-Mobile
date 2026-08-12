import { useMemo, useState } from 'react';
import { FlatList, RefreshControl, TextInput } from 'react-native';
import { KeyboardAwareFlatList } from '../../../../components/ui/KeyboardAwareScrollView';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { RotateCcw } from 'lucide-react-native';
import { Spinner, Text, YStack } from 'tamagui';
import { BIZLINK_COLORS, BIZLINK_FONTS } from '../../../../lib/theme';
import { useLostOpportunities } from '../../../../lib/use-lost-opportunities';
import { usePagination, PAGINATION_PAGE_SIZE } from '../../../../lib/use-pagination';
import { BizTopBar } from '../../../../components/bizlink/BizTopBar';
import { BizButton } from '../../../../components/bizlink/BizButton';
import { BizFloatingPager } from '../../../../components/bizlink/BizFloatingPager';
import { BizLostOpportunityRow } from '../../../../components/bizlink/BizLostOpportunityRow';

/**
 * Wireframe `a-lostopps` (Wireframe-Sales-BizLink.html ~line 993,
 * `aRenderLostOpportunities()` ~line 1355 — 2026-08-02 rule at the top of
 * that function): Sales/RSR NEVER see cooling-down/not-yet-reassignable
 * records here — no countdown, no locked card, no filter chips. This list
 * only ever shows rows the caller is allowed to claim; search + pager only,
 * matching the wireframe's `#a-lostFilter` container being left empty.
 */
export default function LostOpportunitiesScreen() {
  const insets = useSafeAreaInsets();
  const { items, loading, error, reload } = useLostOpportunities();
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return items;
    return items.filter((item) =>
      [item.companyName, item.city, item.reason].filter(Boolean).join(' ').toLowerCase().includes(query)
    );
  }, [items, search]);

  const { page, totalPages, pageItems, setPage } = usePagination(filtered, search.trim().toLowerCase());

  return (
    <YStack flex={1} backgroundColor={BIZLINK_COLORS.canvas} paddingTop={insets.top}>
      <BizTopBar title="Lost Opportunities" fallbackHref="/(tabs)" />
      <YStack paddingHorizontal="$4" paddingTop="$2">
        <Text fontSize={13} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted} marginBottom="$3" lineHeight={19}>
          A client appears here when it was lost — either declared lost, or with no meeting for 6 months.
          Once it has been on this list for 1 month, the first eligible Sales/RSR agent who claims it takes over
          the client.
        </Text>
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search company, city, or reason..."
          placeholderTextColor={BIZLINK_COLORS.muted}
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
            marginBottom: 12,
          }}
        />
      </YStack>

      {loading && !items.length ? (
        <YStack flex={1} justifyContent="center" alignItems="center">
          <Spinner size="large" color={BIZLINK_COLORS.brand} />
        </YStack>
      ) : error ? (
        <YStack flex={1} justifyContent="center" alignItems="center" gap="$3" paddingHorizontal="$5">
          <Text fontSize={13} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted} textAlign="center">
            {error}
          </Text>
          <BizButton small label="Try again" variant="white" onPress={reload} />
        </YStack>
      ) : (
        <KeyboardAwareFlatList
          data={pageItems}
          keyboardShouldPersistTaps="handled"
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 120 }}
          renderItem={({ item, index }) => (
            <BizLostOpportunityRow
              item={item}
              rowNumber={index + 1 + (page - 1) * PAGINATION_PAGE_SIZE}
              onPress={() => router.push(`/(tabs)/more/lost-opportunities/${item.id}`)}
            />
          )}
          refreshControl={<RefreshControl refreshing={loading} onRefresh={reload} />}
          ListEmptyComponent={
            <YStack alignItems="center" padding="$8" gap="$2.5">
              <RotateCcw size={28} color={BIZLINK_COLORS.muted} strokeWidth={1.75} />
              <Text fontSize={13} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted} textAlign="center">
                There are no opportunities you can claim right now.
              </Text>
            </YStack>
          }
        />
      )}

      {filtered.length > 0 ? (
        <BizFloatingPager page={page} totalPages={totalPages} onPageChange={setPage} bottomOffset={insets.bottom + 16} />
      ) : null}
    </YStack>
  );
}
