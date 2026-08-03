import type { LostOpportunityAvailability } from './lost-opportunity-read-service';

// Batch 9 Step D (2026-08-02): extracted so the chip filter logic is
// independently testable, same pattern as `lib/team-attention-filter.ts`.
// Mirrors Wireframe-Manager-BizLink.html's `renderLostOpportunities()`
// exactly — same chip values/labels and the same predicate, not a newly
// invented one: `shown=lostOpportunities.filter(function(o){return
// (lostFilterVal==='all'||o.availability===lostFilterVal)&&...});`.

export type LostOpportunityFilterValue = 'all' | LostOpportunityAvailability;

export const LOST_OPPORTUNITY_FILTER_OPTIONS: Array<{ value: LostOpportunityFilterValue; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'available', label: 'Available now' },
  { value: 'cooling', label: 'Cooling down' },
];

export function filterByAvailability<T extends { availability: LostOpportunityAvailability }>(
  items: readonly T[],
  filter: LostOpportunityFilterValue
): T[] {
  if (filter === 'all') return [...items];
  return items.filter((item) => item.availability === filter);
}
