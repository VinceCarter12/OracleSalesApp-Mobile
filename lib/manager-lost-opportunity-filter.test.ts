import { describe, expect, it } from 'vitest';
import { filterByAvailability } from './manager-lost-opportunity-filter';

function item(id: string, availability: 'available' | 'cooling') {
  return { id, availability };
}

describe('filterByAvailability', () => {
  const items = [item('a', 'available'), item('b', 'cooling'), item('c', 'available')];

  it("'all' returns every item unchanged", () => {
    expect(filterByAvailability(items, 'all')).toEqual(items);
  });

  it("'available' keeps only available items", () => {
    expect(filterByAvailability(items, 'available').map((i) => i.id)).toEqual(['a', 'c']);
  });

  it("'cooling' keeps only cooling items", () => {
    expect(filterByAvailability(items, 'cooling').map((i) => i.id)).toEqual(['b']);
  });
});
