import { Pressable } from 'react-native';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { Text, View, XStack } from 'tamagui';
import { useBizlinkColors, BIZLINK_FONTS } from '../../lib/theme';

interface BizFloatingPagerProps {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  /** Distance from the screen bottom, e.g. `insets.bottom + 16` — matches the caller's own safe-area handling instead of assuming one. */
  bottomOffset: number;
}

/**
 * Floating pill-shaped pager anchored above the bottom safe area —
 * originally "Tag-Along Status"'s own inline pattern (2026-08-04), pulled
 * out so every paginated list gets the same floating treatment instead of
 * each screen re-implementing its own absolute-positioned overlay
 * (`_meta/engineering-principles.md` reuse-first). 1-indexed `page`,
 * matching `BizPager`'s existing convention. Render as a sibling AFTER the
 * scrollable list/FlatList inside a `position`-default (relative) root
 * `YStack`/`View` — never inside a `ListFooterComponent`, since
 * `position="absolute"` needs a positioned ancestor the list content itself
 * can't provide reliably.
 */
export function BizFloatingPager({ page, totalPages, onPageChange, bottomOffset }: BizFloatingPagerProps) {
  const BIZLINK_COLORS = useBizlinkColors();
  if (totalPages <= 0) return null;
  const pages = Array.from({ length: totalPages }, (_, i) => i + 1);

  return (
    <View position="absolute" bottom={bottomOffset} left={0} right={0} alignItems="center" pointerEvents="box-none">
      <XStack
        backgroundColor={BIZLINK_COLORS.card}
        borderRadius={999}
        padding={8}
        gap="$2"
        alignItems="center"
        style={{
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 3 },
          shadowOpacity: 0.16,
          shadowRadius: 5,
          elevation: 5,
        }}
      >
        <Pressable
          accessibilityLabel="Previous page"
          disabled={page === 1}
          onPress={() => onPageChange(page - 1)}
          style={{
            width: 40,
            height: 40,
            borderRadius: 20,
            justifyContent: 'center',
            alignItems: 'center',
            opacity: page === 1 ? 0.4 : 1,
          }}
        >
          <ChevronLeft size={20} color={BIZLINK_COLORS.text} strokeWidth={2} />
        </Pressable>

        {pages.map((p) => {
          const selected = p === page;
          return (
            <Pressable
              key={p}
              accessibilityLabel={`Page ${p}`}
              accessibilityState={{ selected }}
              onPress={() => onPageChange(p)}
              style={{
                width: 44,
                height: 44,
                borderRadius: 22,
                backgroundColor: selected ? BIZLINK_COLORS.brand : 'transparent',
                justifyContent: 'center',
                alignItems: 'center',
              }}
            >
              <Text fontSize={16} fontFamily={BIZLINK_FONTS.semibold} color={selected ? '#FFFFFF' : BIZLINK_COLORS.text}>
                {p}
              </Text>
            </Pressable>
          );
        })}

        <Pressable
          accessibilityLabel="Next page"
          disabled={page === totalPages}
          onPress={() => onPageChange(page + 1)}
          style={{
            width: 40,
            height: 40,
            borderRadius: 20,
            justifyContent: 'center',
            alignItems: 'center',
            opacity: page === totalPages ? 0.4 : 1,
          }}
        >
          <ChevronRight size={20} color={BIZLINK_COLORS.text} strokeWidth={2} />
        </Pressable>
      </XStack>
    </View>
  );
}
