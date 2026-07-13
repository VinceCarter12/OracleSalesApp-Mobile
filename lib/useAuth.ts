import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './supabase';
import { withTimeout } from './with-timeout';

export function useAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Timeout-guarded so a hung GoTrue call surfaces as a resolved (empty)
    // session instead of leaving `loading` stuck forever.
    withTimeout(supabase.auth.getSession(), 8000, 'getSession')
      .then(({ data: { session } }) => {
        setSession(session);
        setLoading(false);
      })
      .catch((err) => {
        console.error('[useAuth] getSession failed/timed out:', (err as Error).message);
        setLoading(false);
      });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  function signOut() {
    return supabase.auth.signOut();
  }

  async function signInWithPassword(email: string, password: string) {
    try {
      const { data, error } = await withTimeout(
        supabase.auth.signInWithPassword({ email, password }),
        10000,
        'signInWithPassword'
      );
      return { error, userId: data.user?.id ?? null };
    } catch (err) {
      console.error('[useAuth] signInWithPassword threw/timed out:', (err as Error).message);
      return { error: err as Error, userId: null };
    }
  }

  return { session, loading, signOut, signInWithPassword };
}
