import { Pressable } from 'react-native';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { Text, XStack } from 'tamagui';
import { useBizlinkColors, BIZLINK_FONTS, BIZLINK_ON_INK } from '../../lib/theme';

interface BizPagerProps {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

/**
 * Wireframe-Sales-BizLink.html's `aRenderPager(id,current,total,handler)`
 * (line 1617): prev chevron, one numbered button per page, next chevron —
 * prev/next disabled at the bounds, current page highlighted. Rendered only
 * when there's more than one page, same as the wireframe never showing a
 * pager for a single-page result (it still calls `aRenderPager` with
 * total=1, which yields disabled prev/next around a single "1" button).
 */
export function BizPager({ page, totalPages, onPageChange }: BizPagerProps) {
  const BIZLINK_COLORS = useBizlinkColors();
  const pages = Array.from({ length: totalPages }, (_, i) => i + 1);

  return (
    <XStack gap="$1.5" alignItems="center" justifyContent="center" marginTop="$2" flexWrap="wrap">
      <Pressable
        accessibilityLabel="Previous page"
        disabled={page === 1}
        onPress={() => onPageChange(page - 1)}
        style={{
          width: 44,
          height: 44,
          borderRadius: 999,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: BIZLINK_COLORS.soft,
          opacity: page === 1 ? 0.4 : 1,
        }}
      >
        <ChevronLeft size={16} color={BIZLINK_COLORS.text} strokeWidth={1.75} />
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
              minWidth: 44,
              height: 44,
              paddingHorizontal: 12,
              borderRadius: 999,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: selected ? BIZLINK_COLORS.ink : BIZLINK_COLORS.soft,
            }}
          >
            <Text
              fontFamily={BIZLINK_FONTS.semibold}
              fontSize={12.5}
              color={selected ? BIZLINK_ON_INK.solid : BIZLINK_COLORS.muted}
            >
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
          width: 44,
          height: 44,
          borderRadius: 999,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: BIZLINK_COLORS.soft,
          opacity: page === totalPages ? 0.4 : 1,
        }}
      >
        <ChevronRight size={16} color={BIZLINK_COLORS.text} strokeWidth={1.75} />
      </Pressable>
    </XStack>
  );
}
