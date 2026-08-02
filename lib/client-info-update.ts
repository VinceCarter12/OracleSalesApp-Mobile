import { normalizeCompanyName } from './company-name';
import { toRemoteCustomerType } from './remote-client-mapping';
import type { ClientStatus } from '../types';

// Batch 6 PR D: pure field-resolution logic for `updateClientInfo()`
// (lib/client-service.ts), split out to stay under the 300-line file limit
// — same reason/pattern as client-duplicate-check.ts, client-similarity.ts,
// and office-pin-service.ts in that file. No I/O here, directly unit-testable.

/**
 * ADR-052: `undefined` means "caller didn't touch this field" (every
 * existing caller pre-dating Batch 6) — preserve the current DB value
 * rather than clobbering it with NULL. An explicit `null`/`''` genuinely
 * clears it.
 */
export function resolveMinorNotesForUpdate(incoming: string | null | undefined, existing: string | null): string | null {
  if (incoming === undefined) return existing;
  if (incoming === null) return null;
  return incoming.trim() || null;
}

export interface ExistingClientInfoRow {
  details_completed_at: string | null;
  minor_notes: string | null;
  company_name: string;
  status: ClientStatus | null;
}

export interface ResolvedClientInfoUpdate {
  companyName: string;
  normalizedName: string;
  status: ClientStatus | null;
  customerType: ReturnType<typeof toRemoteCustomerType>;
  minorNotes: string | null;
  detailsCompletedAt: string;
}

export interface ResolveClientInfoUpdateInput {
  companyName?: string;
  markExisting?: boolean;
  minorNotes?: string | null;
}

/**
 * Resolves the two Batch 6 PR D fields (companyName, markExisting) plus the
 * pre-existing minorNotes/detailsCompletedAt resolution, all sharing the
 * same "undefined preserves the current value" rule — needed so
 * complete.tsx's minor_notes-only direct-write branch (approval-required
 * fields still pending manager review) can call `updateClientInfo()`
 * without silently re-applying an unapproved company_name/customer_type
 * edit.
 */
export function resolveClientInfoUpdate(
  input: ResolveClientInfoUpdateInput,
  existing: ExistingClientInfoRow | null,
  now: string
): ResolvedClientInfoUpdate {
  const companyName = input.companyName !== undefined ? input.companyName.trim() : existing?.company_name ?? '';
  // One-way override only (Wireframe-Sales-BizLink ~line 623's "Existing
  // client" tile) — never regresses an already-'existing' client back down.
  const status: ClientStatus | null = input.markExisting ? 'existing' : existing?.status ?? null;
  return {
    companyName,
    normalizedName: normalizeCompanyName(companyName),
    status,
    customerType: toRemoteCustomerType(status),
    minorNotes: resolveMinorNotesForUpdate(input.minorNotes, existing?.minor_notes ?? null),
    detailsCompletedAt: existing?.details_completed_at ?? now,
  };
}
