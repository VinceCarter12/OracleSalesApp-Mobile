import { useCallback, useEffect, useState } from 'react';
import { useSQLiteContext } from 'expo-sqlite';
import { useSession } from './session-store';
import { rowToClient, type LocalClientRow } from './local-client-mapper';
import type { Client } from '../types';

// T-003: local SQLite is the primary read path (ADR-001) — every write
// (create.tsx, record.tsx's meeting-first branch) lands here first via
// client-service.ts, and syncDown() mirrors the agent's own server records
// down, so this is a superset of "pending + synced" without needing a
// Supabase call at all.

export function useClients() {
  const db = useSQLiteContext();
  const { profileId } = useSession();
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);

  // Scoped by `profiles.id` (not the Auth uid) — matches what's actually
  // stored in `clients.agent_id` locally and `assigned_agent_id` remotely
  // (see lib/session-store.tsx).
  const fetch = useCallback(async () => {
    if (!profileId) {
      setClients([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const rows = await db.getAllAsync<LocalClientRow>(
      'SELECT * FROM clients WHERE agent_id = ? ORDER BY created_at DESC',
      [profileId]
    );
    setClients(rows.map(rowToClient));
    setLoading(false);
  }, [db, profileId]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return { clients, loading, refresh: fetch };
}
