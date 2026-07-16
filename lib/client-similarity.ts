import { getDb } from './db';
import { normalizeCompanyName } from './company-name';
import type { SQLiteDatabase } from 'expo-sqlite';

// T-014 (ADR-022 #12): duplicate-detection SOFT warnings — split out of
// client-service.ts (300-line file limit), same pattern as sync-down.ts's
// split from sync-engine.ts. This is advisory only; the hard save gate is
// `checkCompanyNameDuplicate` in client-service.ts and is unchanged.

const SIMILAR_NAME_TOKEN_MIN_LENGTH = 4;
const MAX_SIMILAR_NAME_MATCHES = 3;
// Excluded so two genuinely different companies that both happen to be
// "... Corp" or "... Trading" don't get flagged as similar.
const COMMON_COMPANY_TOKENS = new Set([
  'corp', 'corporation', 'incorporated', 'company', 'trading', 'enterprise',
  'enterprises', 'group', 'international', 'philippines', 'industries',
]);

export interface SimilarCompanyWarnings {
  similarNames: string[];
  samePhoneClient: { id: string; company_name: string } | null;
}

function significantTokens(normalized: string): string[] {
  return normalized
    .split(' ')
    .filter((token) => token.length >= SIMILAR_NAME_TOKEN_MIN_LENGTH && !COMMON_COMPANY_TOKENS.has(token));
}

async function findSimilarNames(db: SQLiteDatabase, inputTokens: string[], excludeId: string): Promise<string[]> {
  const candidates = await db.getAllAsync<{ company_name: string; normalized_name: string }>(
    `SELECT company_name, normalized_name FROM clients WHERE id != ?
     UNION
     SELECT company_name, normalized_name FROM company_names_snapshot WHERE client_id != ?`,
    [excludeId, excludeId]
  );

  const matches: string[] = [];
  for (const candidate of candidates) {
    const candidateTokens = significantTokens(candidate.normalized_name);
    if (inputTokens.some((token) => candidateTokens.includes(token))) {
      matches.push(candidate.company_name);
      if (matches.length >= MAX_SIMILAR_NAME_MATCHES) break;
    }
  }
  return matches;
}

/**
 * Advisory-only, NEVER blocks save — the hard gate is
 * `checkCompanyNameDuplicate` (client-service.ts), which remains the actual
 * save gate. A cheap word-overlap heuristic (share >=1 significant token,
 * excluding common corporate words) is enough for a soft "did you mean an
 * existing client?" prompt; a full trigram/Levenshtein match is overkill for
 * v1 and would cost more on-device CPU than the UX benefit justifies. Not
 * wired into any screen yet (Phase B) — a future screen calls this directly.
 */
export async function checkSimilarCompanyWarnings(
  companyName: string,
  contactNumber: string | null,
  excludeClientId?: string
): Promise<SimilarCompanyWarnings> {
  const normalized = normalizeCompanyName(companyName);
  const inputTokens = significantTokens(normalized);
  const excludeId = excludeClientId ?? '';
  const db = await getDb();

  const similarNames = inputTokens.length ? await findSimilarNames(db, inputTokens, excludeId) : [];

  const trimmedPhone = contactNumber?.trim();
  const samePhoneClient = trimmedPhone
    ? await db.getFirstAsync<{ id: string; company_name: string }>(
        'SELECT id, company_name FROM clients WHERE contact_number = ? AND id != ? LIMIT 1',
        [trimmedPhone, excludeId]
      )
    : null;

  return { similarNames, samePhoneClient: samePhoneClient ?? null };
}
