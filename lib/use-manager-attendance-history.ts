import { useCallback, useEffect, useState } from 'react';
import { useAppDb } from './app-db-provider';
import { useSession } from './session-store';
import { useManagerScope } from './manager-scope-store';
import { getManagerAttendanceHistory, type ManagerAttendanceRecord } from './manager-attendance-history-service';
import { subscribeSyncComplete } from './sync/sync-events';
import type { ManagerScope } from './manager-scope';

/**
 * `scopeOverride` (2026-08-19) lets a screen own its record scope locally
 * instead of reading the session-wide `ManagerScopeProvider`. Tag-Along
 * Attendance needs this: Vince asked that page to default to 'combined'
 * (it is the Manager's record of tagged-along visits, and
 * `getManagerAttendanceHistory()` returns tag-along rows only under
 * 'combined'), but the store is shared with Manager Home, Clients, Maps and
 * Meetings — writing 'combined' into it would silently re-scope all of those
 * too. Omit the argument to keep the original shared-store behavior.
 */
export function useManagerAttendanceHistory(scopeOverride?: ManagerScope) {
  const db = useAppDb();
  const { profileId } = useSession();
  const { scope: sessionScope } = useManagerScope();
  const scope = scopeOverride ?? sessionScope;
  const [records, setRecords] = useState<ManagerAttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const reload = useCallback(async () => {
    if (!profileId) { setRecords([]); setLoading(false); return; }
    setLoading(true); setError(null);
    try { setRecords(await getManagerAttendanceHistory(profileId, scope, db)); }
    catch (err) { setError(err instanceof Error ? err.message : 'Attendance history is unavailable offline.'); }
    finally { setLoading(false); }
  }, [db, profileId, scope]);
  useEffect(() => { void reload(); }, [reload]);
  useEffect(() => subscribeSyncComplete(reload), [reload]);
  return { records, loading, error, reload };
}
