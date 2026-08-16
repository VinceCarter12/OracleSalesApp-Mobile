import { describe, expect, it } from 'vitest';
import { getSuggestedPsgcLocalities, searchPsgcLocalities } from './psgc-locality-search';

describe('PSGC locality picker data', () => {
  it('has selectable suggestions before a user searches', () => {
    const suggestions = getSuggestedPsgcLocalities();
    expect(suggestions).toHaveLength(4);
    expect(suggestions.every((locality) => locality.code && locality.name && locality.province)).toBe(true);
  });

  it('still searches by locality or province', () => {
    expect(searchPsgcLocalities('Quezon').some((locality) => locality.name === 'Quezon City')).toBe(true);
    expect(searchPsgcLocalities('Bataan').some((locality) => locality.province === 'Bataan')).toBe(true);
  });
});
