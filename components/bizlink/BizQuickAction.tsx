import { Pressable } from 'react-native';
import { Text, View } from 'tamagui';
import { BIZLINK_COLORS, BIZLINK_FONTS } from '../../lib/theme';

interface BizQuickActionProps {
  icon: React.ReactNode;
  label: string;
  onPress: () => void;
  /** Optional red count dot (Wireframe `.qadot`) — added in T-014 Phase 3 for Manager's Approvals/Tag-Along quick actions; unused by existing Sales Agent callers. */
  badgeCount?: number;
}

/**
 * T-014 Phase 2 (ADR-024): BizLink `.qa` quick action — icon-in-circle, no
 * box/border, label underneath. Replaces `QuickAction` within `app/(tabs)`.
 * Reused as-is (per ADR-024 Phase 3) for Manager quick actions.
 */
export function BizQuickAction({ icon, label, onPress, badgeCount }: BizQuickActionProps) {
  return (
    <Pressable
      onPress={onPress}
      style={{ width: 78, alignItems: 'center', gap: 8, minHeight: 44 }}
    >
      <View
        width={52}
        height={52}
        borderRadius={26}
        backgroundColor={BIZLINK_COLORS.tintA}
        alignItems="center"
        justifyContent="center"
        position="relative"
      >
        {icon}
        {badgeCount && badgeCount > 0 ? (
          <View
            position="absolute"
            top={-4}
            right={-4}
            backgroundColor={BIZLINK_COLORS.red}
            borderRadius={999}
            paddingHorizontal={5}
            minWidth={16}
            height={16}
            alignItems="center"
            justifyContent="center"
          >
            <Text fontSize={9.5} fontFamily={BIZLINK_FONTS.semibold} color={BIZLINK_COLORS.card}>
              {badgeCount}
            </Text>
          </View>
        ) : null}
      </View>
      <Text fontSize={10.5} fontFamily={BIZLINK_FONTS.semibold} color={BIZLINK_COLORS.text} textAlign="center">
        {label}
      </Text>
    </Pressable>
  );
}
