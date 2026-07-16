import { useCallback, useEffect, useState } from 'react';
import { useSQLiteContext } from 'expo-sqlite';
import { useAuth } from './useAuth';
import { rowToMeeting, type LocalMeetingRow } from './local-meeting-mapper';
import type { Meeting } from '../types';

// T-004: local SQLite is the primary read path (ADR-001), mirroring
// useClients.ts. This used to query Supabase directly ordered by `logged_at`
// — a column that never existed remotely (the real column is `meeting_date`,
// see Bugs.md B-011) — so every fetch silently errored and returned nothing.

export function useMeetings(clientId?: string) {
  const db = useSQLiteContext();
  const { session } = useAuth();
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    if (!session) {
      setMeetings([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const rows = await db.getAllAsync<LocalMeetingRow>(
      clientId
        ? `SELECT m.*, c.company_name as client_name
           FROM meetings m LEFT JOIN clients c ON c.id = m.client_id
           WHERE m.agent_id = ? AND m.client_id = ?
           ORDER BY m.logged_at DESC`
        : `SELECT m.*, c.company_name as client_name
           FROM meetings m LEFT JOIN clients c ON c.id = m.client_id
           WHERE m.agent_id = ?
           ORDER BY m.logged_at DESC`,
      clientId ? [session.user.id, clientId] : [session.user.id]
    );
    setMeetings(rows.map(rowToMeeting));
    setLoading(false);
  }, [db, session, clientId]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return { meetings, loading, refresh: fetch };
}
