import { YStack, type YStackProps } from 'tamagui';
import { useBizlinkColors } from '../../lib/theme';

interface BizCardProps extends YStackProps {
  /** Tinted "flat" surface (Design-System-Catalog §3 "Tinted stat card" / .card-flat) instead of the borderless white card. */
  flat?: boolean;
}

/**
 * T-014 Phase 2 (ADR-024): BizLink borderless card — 24px radius, white
 * surface, soft shadow, no border. Scoped to `app/(tabs)` for this phase;
 * NOT a replacement for `components/ui/Card.tsx` (still used by Manager/
 * Executive, out of scope until Phase 3/4) — see Design-System-Catalog §3.
 */
export function BizCard({ flat = false, children, ...rest }: BizCardProps) {
  const BIZLINK_COLORS = useBizlinkColors();
  return (
    <YStack
      backgroundColor={flat ? BIZLINK_COLORS.tintA : BIZLINK_COLORS.card}
      borderRadius={24}
      padding={18}
      shadowColor="rgba(18,39,28,0.05)"
      shadowOffset={{ width: 0, height: 1 }}
      shadowOpacity={1}
      shadowRadius={2}
      {...rest}
    >
      {children}
    </YStack>
  );
}
