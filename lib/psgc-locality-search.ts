import { PSGC_LOCALITIES, type PsgcLocality } from './data/psgc-localities';

const DEFAULT_RESULT_LIMIT = 10;

/**
 * ADR-055: offline runtime search over the bundled PSGC dataset for the
 * Create Client canonical city/municipality selector. Case-insensitive
 * substring match on name (and province, for disambiguating same-named
 * localities across provinces); prefix matches on name rank first. Returns
 * `[]` for an empty/whitespace query rather than the whole 1,656-row list.
 */
export function searchPsgcLocalities(query: string, limit: number = DEFAULT_RESULT_LIMIT): PsgcLocality[] {
  const trimmed = query.trim().toLowerCase();
  if (!trimmed) return [];

  const prefixMatches: PsgcLocality[] = [];
  const substringMatches: PsgcLocality[] = [];

  for (const locality of PSGC_LOCALITIES) {
    const name = locality.name.toLowerCase();
    const province = locality.province.toLowerCase();
    if (name.startsWith(trimmed)) {
      prefixMatches.push(locality);
    } else if (name.includes(trimmed) || province.includes(trimmed)) {
      substringMatches.push(locality);
    }
    if (prefixMatches.length >= limit) break;
  }

  return [...prefixMatches, ...substringMatches].slice(0, limit);
}
