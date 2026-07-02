import { useCallback, useEffect, useState } from 'react';
import { supabase } from './supabase';
import type { Meeting } from '../types';

export function useMeetings(clientId?: string) {
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    setLoading(true);
    let query = supabase
      .from('meetings')
      .select(`
        *,
        clients ( company_name )
      `)
      .order('logged_at', { ascending: false });

    if (clientId) {
      query = query.eq('client_id', clientId);
    }

    const { data, error } = await query;
    if (!error && data) {
      setMeetings(
        data.map((m: any) => ({
          ...m,
          client_name: m.clients?.company_name ?? null,
        })) as Meeting[]
      );
    }
    setLoading(false);
  }, [clientId]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return { meetings, loading, refresh: fetch };
}
