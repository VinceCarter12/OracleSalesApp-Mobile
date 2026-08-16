import type { ReactNode } from 'react';
import { View, XStack, YStack } from 'tamagui';

export const QUICK_ACTION_COLUMN_WIDTH = 78;
export const QUICK_ACTION_GAP = 8;

export function computeQuickActionColumns(screenWidth: number, horizontalPadding: number): number {
  const available = screenWidth - horizontalPadding * 2;
  const calculated = Math.floor((available + QUICK_ACTION_GAP) / (QUICK_ACTION_COLUMN_WIDTH + QUICK_ACTION_GAP));
  return screenWidth >= 344 ? 4 : Math.max(3, calculated);
}

interface BizQuickActionGridProps {
  actions: ReactNode[];
  columns: number;
  rowGap?: number;
}

/**
 * Shared BizLink quick-action grid.
 *
 * Renders full-width rows and adds invisible placeholder cells for any
 * missing trailing columns so partial rows keep the same horizontal tracks as
 * full rows.
 */
export function BizQuickActionGrid({ actions, columns, rowGap = 16 }: BizQuickActionGridProps) {
  const rows: ReactNode[][] = [];
  for (let index = 0; index < actions.length; index += columns) {
    const row = actions.slice(index, index + columns);
    while (row.length < columns) {
      row.push(
        <View
          key={`placeholder-${index}-${row.length}`}
          width={QUICK_ACTION_COLUMN_WIDTH}
          opacity={0}
          pointerEvents="none"
          accessible={false}
          importantForAccessibility="no-hide-descendants"
        />
      );
    }
    rows.push(row);
  }

  return (
    <YStack gap={rowGap}>
      {rows.map((row, index) => (
        <XStack key={index} width="100%" justifyContent="space-between" alignItems="flex-start">
          {row}
        </XStack>
      ))}
    </YStack>
  );
}
