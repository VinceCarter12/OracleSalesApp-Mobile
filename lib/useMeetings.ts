import { useCallback, useEffect, useState } from 'react';
import { useSQLiteContext } from 'expo-sqlite';
import { useSession } from './session-store';
import { rowToMeeting, type LocalMeetingRow } from './local-meeting-mapper';
import { subscribeSyncComplete } from './sync/sync-events';
import type { Meeting } from '../types';

// T-004: local SQLite is the primary read path (ADR-001), mirroring
// useClients.ts. This used to query Supabase directly ordered by `logged_at`
// — a column that never existed remotely (the real column is `meeting_date`,
// see Bugs.md B-011) — so every fetch silently errored and returned nothing.
//
// B-025: was scoped by `useAuth().session.user.id` (the Auth uid) — same
// class of bug as B-015 (clients had the identical mistake, already fixed
// there). Every meeting is written locally with `agent_id = profileId`
// (`profiles.id`, NOT the Auth uid — see lib/session-store.tsx), so this
// WHERE clause matched zero rows even though the meetings genuinely existed
// in SQLite: a recorded meeting was invisible in every list (My Meetings,
// client detail's meeting history) despite having saved successfully.

export function useMeetings(clientId?: string) {
  const db = useSQLiteContext();
  const { profileId } = useSession();
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    if (!profileId) {
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
      clientId ? [profileId, clientId] : [profileId]
    );
    setMeetings(rows.map(rowToMeeting));
    setLoading(false);
  }, [db, profileId, clientId]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  // B-071: a background syncDown() (e.g. right after login) writes to
  // SQLite well after this hook's initial fetch already ran — without this,
  // the screen stays on its stale (often empty, post-account-switch) read
  // until the user manually pulls to refresh or navigates away and back.
  useEffect(() => subscribeSyncComplete(fetch), [fetch]);

  return { meetings, loading, refresh: fetch };
}
