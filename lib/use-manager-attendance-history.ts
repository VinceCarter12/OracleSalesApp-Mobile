import { useCallback, useEffect, useState } from 'react';
import { useAppDb } from './app-db-provider';
import { useSession } from './session-store';
import { useManagerScope } from './manager-scope-store';
import { getManagerAttendanceHistory, type ManagerAttendanceRecord } from './manager-attendance-history-service';
import { subscribeSyncComplete } from './sync/sync-events';

export function useManagerAttendanceHistory() {
  const db = useAppDb();
  const { profileId } = useSession();
  const { scope } = useManagerScope();
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
