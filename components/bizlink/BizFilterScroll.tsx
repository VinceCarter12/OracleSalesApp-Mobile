import { ScrollView } from 'react-native';
import { BizChip } from './BizChip';

export interface BizFilterOption<T extends string> {
  value: T;
  label: string;
}

interface BizFilterScrollProps<T extends string> {
  options: BizFilterOption<T>[];
  /** `null` renders every chip unselected (e.g. a toggle-row with no "all" chip whose current state is "no filter applied"). */
  value: T | null;
  onChange: (value: T) => void;
}

/**
 * Design-System-Catalog §"Needed before implementation" BizFilterScroll —
 * generic horizontal scrollable filter-chip row, composing the existing
 * `BizChip` pill (not reimplementing it). Used directly here by the
 * Approvals inbox's two combinable filter rows (status, request-kind); also
 * the intended base for the later `BizScopeFilter` (PR C, not built here).
 */
export function BizFilterScroll<T extends string>({ options, value, onChange }: BizFilterScrollProps<T>) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ gap: 8, paddingVertical: 4 }}
    >
      {options.map((option) => (
        <BizChip
          key={option.value}
          label={option.label}
          selected={value === option.value}
          onPress={() => onChange(option.value)}
        />
      ))}
    </ScrollView>
  );
}
