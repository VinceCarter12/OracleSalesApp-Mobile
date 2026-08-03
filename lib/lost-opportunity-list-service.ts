import { fetchLostOpportunities, type LostOpportunityRecord } from './lost-opportunity-read-service';

export { fetchLastMeetingSummary, type LostOpportunityLastMeeting } from './lost-opportunity-read-service';

// Batch 9 Step D (2026-08-02): thin wrapper over the shared
// `lib/lost-opportunity-read-service.ts` (`scope: 'claimable'`) — Step C's
// query logic (server-side cooldown/current-owner filter + Migration 062's
// historical former-owner exclusion) now lives there, generalized for reuse
// by Manager (`scope: 'team'`) and Executive (`scope: 'company'`). This file
// stays only to keep `app/(tabs)/more/lost-opportunities/*` and
// `components/bizlink/BizLostOpportunityRow.tsx`'s existing
// `LostOpportunityListItem` shape (no `availability`/`assignedAgentId`
// fields Sales/RSR never needed) — same public behavior as before this
// refactor, not a feature change.

export interface LostOpportunityListItem {
  id: string;
  companyName: string;
  city: string | null;
  channel: string | null;
  lostAt: string | null;
  reason: string | null;
  contactPerson: string | null;
  contactPosition: string | null;
  officeAddress: string | null;
  officeLat: number | null;
  officeLng: number | null;
  officePinVerified: boolean;
}

function toListItem(record: LostOpportunityRecord): LostOpportunityListItem {
  return {
    id: record.id,
    companyName: record.companyName,
    city: record.city,
    channel: record.channel,
    lostAt: record.lostAt,
    reason: record.reason,
    contactPerson: record.contactPerson,
    contactPosition: record.contactPosition,
    officeAddress: record.officeAddress,
    officeLat: record.officeLat,
    officeLng: record.officeLng,
    officePinVerified: record.officePinVerified,
  };
}

/**
 * Full claimable list for `profileId` — see
 * `lib/lost-opportunity-read-service.ts`'s `scope: 'claimable'` doc-comment
 * for the actual filter/exclusion logic. Defensive re-check (item 5): this
 * is always a fresh live read, never cached — the detail screen calls this
 * same function again on its own load, and the claim action itself relies
 * on `claim_lost_opportunity()`'s atomic server-side check as the true
 * gate, so a race between two reads of this list and an actual claim is
 * handled by the RPC's response code, not by trusting this list to still be
 * accurate by the time the user taps "Claim."
 */
export async function fetchClaimableLostOpportunities(profileId: string): Promise<LostOpportunityListItem[]> {
  const records = await fetchLostOpportunities({ scope: 'claimable', profileId });
  return records.map(toListItem);
}
