import { useMemo, useState } from 'react';
import { FlatList, RefreshControl, TextInput } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { RotateCcw } from 'lucide-react-native';
import { Spinner, Text, YStack } from 'tamagui';
import { BIZLINK_COLORS, BIZLINK_FONTS } from '../../../../lib/theme';
import { useManagerLostOpportunities } from '../../../../lib/use-manager-lost-opportunities';
import {
  filterByAvailability,
  LOST_OPPORTUNITY_FILTER_OPTIONS,
  type LostOpportunityFilterValue,
} from '../../../../lib/manager-lost-opportunity-filter';
import { usePagination, PAGINATION_PAGE_SIZE } from '../../../../lib/use-pagination';
import { BizTopBar } from '../../../../components/bizlink/BizTopBar';
import { BizButton } from '../../../../components/bizlink/BizButton';
import { BizFloatingPager } from '../../../../components/bizlink/BizFloatingPager';
import { BizFilterScroll } from '../../../../components/bizlink/BizFilterScroll';
import { BizLostOpportunityRow } from '../../../../components/bizlink/BizLostOpportunityRow';

/**
 * Wireframe `s-lost` (Wireframe-Manager-BizLink.html ~line 767,
 * `renderLostOpportunities()` ~line 1830): "Team visibility only. Sales/RSR
 * ownership and claim actions remain governed by the server lifecycle
 * policy." Unlike Sales/RSR's list, Manager's shows BOTH available AND
 * cooling-down records with `all`/`available`/`cooling` filter chips
 * (default `all`) — deliberately the opposite of the Sales/RSR screen's
 * no-chips, claimable-only list. No claim/reassignment affordance anywhere
 * on this screen.
 */
export default function ManagerLostOpportunitiesScreen() {
  const insets = useSafeAreaInsets();
  const { items, loading, error, reload } = useManagerLostOpportunities();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<LostOpportunityFilterValue>('all');

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    const byAvailability = filterByAvailability(items, filter);
    if (!query) return byAvailability;
    return byAvailability.filter((item) =>
      [item.companyName, item.city, item.reason].filter(Boolean).join(' ').toLowerCase().includes(query)
    );
  }, [items, search, filter]);

  const { page, totalPages, pageItems, setPage } = usePagination(filtered, `${filter}:${search.trim().toLowerCase()}`);

  return (
    <YStack flex={1} backgroundColor={BIZLINK_COLORS.canvas} paddingTop={insets.top}>
      <BizTopBar title="Lost Opportunities" fallbackHref="/(manager)/more" />
      <YStack paddingHorizontal="$4" paddingTop="$2">
        <Text fontSize={13} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted} marginBottom="$3" lineHeight={19}>
          Team visibility only. Sales/RSR ownership and claim actions remain governed by the server lifecycle policy.
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
        <YStack marginBottom="$2.5">
          <BizFilterScroll options={LOST_OPPORTUNITY_FILTER_OPTIONS} value={filter} onChange={setFilter} />
        </YStack>
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
          <BizButton small label="Ulitin" variant="white" onPress={reload} />
        </YStack>
      ) : (
        <FlatList
          data={pageItems}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 120 }}
          renderItem={({ item, index }) => (
            <BizLostOpportunityRow
              item={item}
              rowNumber={index + 1 + (page - 1) * PAGINATION_PAGE_SIZE}
              onPress={() =>
                router.push({ pathname: '/(manager)/more/lost-opportunities/[id]', params: { id: item.id } })
              }
            />
          )}
          refreshControl={<RefreshControl refreshing={loading} onRefresh={reload} />}
          ListEmptyComponent={
            <YStack alignItems="center" padding="$8" gap="$2.5">
              <RotateCcw size={28} color={BIZLINK_COLORS.muted} strokeWidth={1.75} />
              <Text fontSize={13} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted} textAlign="center">
                Walang lost opportunity na tumugma.
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
