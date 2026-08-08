import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { getActiveDraftsForAgent, type MeetingDraft } from './meeting-drafts';
import { getClientById } from './client-service';
import type { Client } from '../types';

export interface ActiveMeetingDraft {
  draft: MeetingDraft;
  client: Client;
}

/**
 * Cross-screen visibility for an in-progress meeting (Vince 2026-08-04
 * direction): `meeting_drafts` already survives navigation/backgrounding/app
 * kill (lib/meeting-drafts.ts), but nothing outside the client's own
 * record/record-visit screen ever surfaced that — an agent who left that
 * screen had no reminder the meeting was still running. Re-fetches on every
 * focus (same pattern as Home's `getClientIdsWithPendingManagerTagAlong`
 * bulk-load) so a Start/Discard/Save elsewhere in the app is reflected
 * without a manual refresh. A draft whose client no longer exists locally is
 * skipped, not surfaced — same "never show an orphaned reference" rule the
 * controller itself applies.
 */
export function useActiveMeetingDrafts(agentId: string | null): {
  activeMeetingDrafts: ActiveMeetingDraft[];
  activeMeetingClientIds: Set<string>;
} {
  const [activeMeetingDrafts, setActiveMeetingDrafts] = useState<ActiveMeetingDraft[]>([]);

  useFocusEffect(
    useCallback(() => {
      if (!agentId) {
        setActiveMeetingDrafts([]);
        return;
      }
      let cancelled = false;
      getActiveDraftsForAgent(agentId)
        .then(async (drafts) => {
          const resolved = await Promise.all(
            drafts.map(async (draft) => {
              const client = await getClientById(draft.clientId);
              return client ? { draft, client } : null;
            })
          );
          if (!cancelled) {
            setActiveMeetingDrafts(resolved.filter((entry): entry is ActiveMeetingDraft => entry !== null));
          }
        })
        .catch((err) => console.error('[useActiveMeetingDrafts] failed to load active drafts:', err));
      return () => {
        cancelled = true;
      };
    }, [agentId])
  );

  const activeMeetingClientIds = new Set(activeMeetingDrafts.map((entry) => entry.draft.clientId));

  return { activeMeetingDrafts, activeMeetingClientIds };
}
