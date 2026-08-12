import { useEffect, useState } from 'react';
import { supabase } from './supabase';

/** Resolve a profile team id to its server-owned display name. */
export function useTeamName(teamId: string | null): string {
  const [teamName, setTeamName] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    if (!teamId) {
      setTeamName(null);
      return () => {
        active = false;
      };
    }

    setTeamName(null);
    supabase
      .from('teams')
      .select('name')
      .eq('id', teamId)
      .maybeSingle()
      .then(
        ({ data, error }) => {
          if (!active) return;
          setTeamName(error ? null : data?.name?.trim() || null);
        },
        () => {
          if (active) setTeamName(null);
        },
      );

    return () => {
      active = false;
    };
  }, [teamId]);

  if (!teamId) return 'No team assigned';
  return teamName ?? 'Team unavailable';
}
