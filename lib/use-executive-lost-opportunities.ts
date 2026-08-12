import { useCallback, useEffect, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { fetchLostOpportunities, type LostOpportunityRecord } from './lost-opportunity-read-service';

// Batch 9 Step D (2026-08-02): migrated off the now-deleted
// `lib/executive-lost-opportunity-service.ts` onto the shared
// `lib/lost-opportunity-read-service.ts` (`scope: 'company'`). This is a
// regression-safe refactor — `ExecLostOpportunity`'s shape and
// `ExecLostOpportunityStatus`'s values ('cooldown'/'released') are kept
// identical to the deleted file's output so
// `app/(executive)/more/lost-opportunity.tsx` doesn't change at all.

export type ExecLostOpportunityStatus = 'cooldown' | 'released';

export interface ExecLostOpportunity {
  id: string;
  companyName: string;
  agentId: string;
  agentName: string | null;
  managerId: string | null;
  managerName: string | null;
  lostAt: string | null;
  reassignableAt: string | null;
  reason: string | null;
  status: ExecLostOpportunityStatus;
}

function toExecLostOpportunity(record: LostOpportunityRecord): ExecLostOpportunity {
  return {
    id: record.id,
    companyName: record.companyName,
    agentId: record.assignedAgentId,
    agentName: record.agentName,
    managerId: record.managerId,
    managerName: record.managerName,
    lostAt: record.lostAt,
    reassignableAt: record.reassignableAt,
    reason: record.reason,
    // `available`/`cooling` (shared service) -> `released`/`cooldown` (this
    // screen's original labels) — same derivation, different vocabulary.
    status: record.availability === 'available' ? 'released' : 'cooldown',
  };
}

export interface UseExecutiveLostOpportunities {
  items: ExecLostOpportunity[];
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;
}

/** B-060: real data for `app/(executive)/more/lost-opportunity.tsx` — mirrors lib/use-executive-overview.ts's loading/error/focus-refresh shape. */
export function useExecutiveLostOpportunities(): UseExecutiveLostOpportunities {
  const [items, setItems] = useState<ExecLostOpportunity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchLostOpportunities({ scope: 'company' });
      setItems(data.map(toExecLostOpportunity));
    } catch (err) {
      console.error('[use-executive-lost-opportunities] load failed:', err instanceof Error ? err.message : String(err));
      setError("The lost opportunity list couldn't be loaded. Try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  return { items, loading, error, reload: load };
}
