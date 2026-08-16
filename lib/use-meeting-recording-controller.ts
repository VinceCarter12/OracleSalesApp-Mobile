import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert } from 'react-native';
import { getClientById } from './client-service';
import { useSession } from './session-store';
import { captureGps } from './gps';
import { useElapsedTimer } from './use-elapsed-timer';
import { showToast } from './toast';
import { getCompanionRosterForViewer, getTeamRoster } from './team-roster';
import { MAX_COMPANIONS_PER_REQUEST, type CompanionSelection } from './tag-along-service';
import {
  companionsForDraft,
  restoreCompanionsFromDraft,
  saveDraft,
  getDraftForClient,
  deleteDraft,
  type MeetingDraft,
} from './meeting-drafts';
import { markLiveSession, hasLiveSession, clearLiveSession } from './meeting-live-session';
import { checkMeetingStartAllowed } from './meeting-ongoing-guard';
import { OngoingMeetingLimitError } from './meeting-drafts';
import type { Client, MeetingMode, TeamRosterEntry } from '../types';
import { companionSelectionsForRecording } from './policies/manager-companion-policy';
import { uuidv4 } from './uuid';

export interface MeetingStartCapture {
  operationId?: string;
  capturedAt: string;
  gpsLat: number;
  gpsLng: number;
}

export type MeetingRecordingFlow = 'full' | 'visit';

export interface UseMeetingRecordingControllerInput {
  clientId: string | undefined;
  /** Which screen owns this session — persisted onto the draft row and drives the resume-disclosure copy (lib/policies/meeting-draft-resume-policy.ts). */
  flow: MeetingRecordingFlow;
}

/**
 * Step B: the shared controller both `record.tsx` (full form) and
 * `record-visit.tsx` (fast path) use for their common behavioral logic —
 * client + roster loading, the Start confirm-dialog + GPS/timestamp lock,
 * the elapsed-meeting timer, companion toggle/limit, the F-205
 * role-scoped companion selection, and (new, both flows now) same-day draft
 * crash-recovery via `lib/meeting-drafts.ts`. The two screens' visually
 * distinct component trees (AutoCapturedPanel/MeetingWrapUpSection/
 * PoEvidenceCard vs PhotoCapture/VisitStartPanel/VisitInProgressPanel,
 * ADR-015) are untouched — only this shared logic layer moved.
 */
export function useMeetingRecordingController({ clientId, flow }: UseMeetingRecordingControllerInput) {
  const { profileId, teamId, role, markSuspended } = useSession();

  const [client, setClient] = useState<Client | null>(null);
  const [clientLoading, setClientLoading] = useState(true);

  const [roster, setRoster] = useState<TeamRosterEntry[]>([]);
  const [rosterLoaded, setRosterLoaded] = useState(false);
  const [rosterLoadError, setRosterLoadError] = useState(false);
  const [selectedCompanions, setSelectedCompanions] = useState<TeamRosterEntry[]>([]);

  const [mode, setMode] = useState<MeetingMode>('in_person');
  const [start, setStart] = useState<MeetingStartCapture | null>(null);
  const [starting, setStarting] = useState(false);
  const [startConfirmOpen, setStartConfirmOpen] = useState(false);
  const [ongoingMeetingWarning, setOngoingMeetingWarning] = useState<'ongoing_meeting' | 'unavailable' | null>(null);

  const [pendingDraft, setPendingDraft] = useState<MeetingDraft | null>(null);
  // A draft found for THIS JS process (hasLiveSession) — restored silently,
  // never shown as a DraftResumePrompt. See lib/meeting-live-session.ts.
  const [autoResumeDraft, setAutoResumeDraft] = useState<MeetingDraft | null>(null);
  // Guards the render-time adjustment below so a given draft is only ever
  // applied once, not on every re-render while `autoResumeDraft` is set.
  const [lastAutoResumedDraftId, setLastAutoResumedDraftId] = useState<string | null>(null);
  // Fires once per silent auto-resume so the two screens can restore their
  // own `selectedAgendas` state (agenda lives outside this controller,
  // same as the explicit resumeDraft() path below already required).
  const [autoResumedAgendas, setAutoResumedAgendas] = useState<string[] | null>(null);

  const elapsedSeconds = useElapsedTimer(start?.capturedAt ?? null);

  // Companions selected so far, kept in a ref so confirmStartMeeting()'s
  // draft write always sees the latest selection without needing it in its
  // own dependency array (it's an event handler, not an effect).
  const selectedCompanionsRef = useRef(selectedCompanions);
  selectedCompanionsRef.current = selectedCompanions;

  // Client + same-day draft lookup (standardized on record-visit.tsx's
  // stricter behavior, 2026-08-02): a client that no longer exists locally
  // now alerts AND discards any orphaned draft, in BOTH flows — record.tsx
  // previously silently no-op'd here.
  useEffect(() => {
    if (!clientId) {
      setClientLoading(false);
      return;
    }
    let cancelled = false;
    setClientLoading(true);
    (async () => {
      const foundClient = await getClientById(clientId);
      if (cancelled) return;
      if (!foundClient) {
        Alert.alert('Error', 'Client not found.');
        await deleteDraft(clientId).catch((err) =>
          console.error('[useMeetingRecordingController] Failed to discard orphaned draft:', err)
        );
        if (profileId) clearLiveSession(profileId, clientId);
        setClientLoading(false);
        return;
      }
      setClient(foundClient);
      if (profileId) {
        const draft = await getDraftForClient(clientId, profileId);
        if (!cancelled && draft) {
          // Vince 2026-08-09: only a draft with NO live-session marker means
          // this JS process never had it running — i.e. the app was actually
          // killed/crashed and relaunched. A draft found WITH the marker
          // means the agent just navigated away and back within the same
          // running app; auto-resume it silently instead of interrupting.
          if (hasLiveSession(profileId, clientId)) {
            setAutoResumeDraft(draft);
          } else {
            setPendingDraft(draft);
          }
        }
      }
      setClientLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [clientId, profileId]);

  useEffect(() => {
    let cancelled = false;
    getTeamRoster(profileId, teamId, role)
      .then((entries) => {
        if (!cancelled) setRoster(entries);
      })
      .catch((err) => {
        console.error('[useMeetingRecordingController] Failed to load companion roster:', err);
        if (!cancelled) setRosterLoadError(true);
      })
      .finally(() => {
        if (!cancelled) setRosterLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [profileId, teamId, role]);

  // The picker and both draft-resume paths must share this fail-closed view.
  // `roster` may be a preserved last-good cache after a failed sync; it is
  // never safe to expose directly to the current viewer.
  const visibleRoster = useMemo(
    () => getCompanionRosterForViewer(roster, role, teamId),
    [roster, role, teamId]
  );

  const currentVisibleCompanions = useCallback(
    (): TeamRosterEntry[] => selectedCompanionsRef.current.filter((entry) =>
      visibleRoster.some((visibleEntry) => visibleEntry.profileId === entry.profileId)
    ),
    [visibleRoster]
  );

  // Silent auto-resume for a same-process draft (see setAutoResumeDraft
  // above). Adjusts state during render rather than in a useEffect — the
  // documented React pattern for "derive state once when an input becomes
  // ready" (react.dev "You Might Not Need An Effect" > Adjusting some state
  // when a prop changes) — since this only needs to run once per draft, not
  // resubscribe to an external system. Waits on `rosterLoaded` exactly like
  // the explicit resumeDraft() callback below does — a draft with
  // companions restored before the roster query settles would drop the
  // selections permanently.
  if (autoResumeDraft && autoResumeDraft.id !== lastAutoResumedDraftId) {
    const hasCompanions = (autoResumeDraft.payload.companions?.length ?? 0) > 0;
    if (!hasCompanions || rosterLoaded) {
      setLastAutoResumedDraftId(autoResumeDraft.id);
      setMode(autoResumeDraft.payload.mode);
      setStart({
        operationId: autoResumeDraft.payload.operationId,
        capturedAt: autoResumeDraft.payload.capturedAt,
        gpsLat: autoResumeDraft.payload.gpsLat,
        gpsLng: autoResumeDraft.payload.gpsLng,
      });
      setSelectedCompanions(hasCompanions ? restoreCompanionsFromDraft(autoResumeDraft.payload.companions, visibleRoster) : []);
      setAutoResumedAgendas(autoResumeDraft.payload.agendas ?? []);
    }
  }

  const toggleCompanion = useCallback((entry: TeamRosterEntry): void => {
    if (role === 'sales_manager') return;
    setSelectedCompanions((prev) => {
      const alreadySelected = prev.some((p) => p.profileId === entry.profileId);
      if (alreadySelected) return prev.filter((p) => p.profileId !== entry.profileId);
      if (prev.length >= MAX_COMPANIONS_PER_REQUEST) {
        showToast('Up to 2 companions are allowed');
        return prev;
      }
      return [...prev, entry];
    });
  }, []);

  const requestStartMeeting = useCallback(async (): Promise<void> => {
    const guard = await checkMeetingStartAllowed(profileId, clientId);
    if (!guard.allowed) {
      setOngoingMeetingWarning(guard.reason);
      return;
    }
    setStartConfirmOpen(true);
  }, [profileId, clientId]);

  const cancelStartMeeting = useCallback((): void => {
    setStartConfirmOpen(false);
  }, []);

  const closeOngoingMeetingWarning = useCallback((): void => {
    setOngoingMeetingWarning(null);
  }, []);

  /**
   * GPS is captured on Start (matches the wireframe's
   * `aRequestRecordStart`/`aRecordConfirmStart`) — the actual GPS fetch only
   * happens after "Yes, start". The draft write must succeed before the UI
   * becomes in-progress: it is the durable record that enforces the one
   * ongoing-meeting limit across every route.
   */
  const confirmStartMeeting = useCallback(async (): Promise<void> => {
    setStartConfirmOpen(false);
    if (!clientId || !profileId) return;
    const guard = await checkMeetingStartAllowed(profileId, clientId);
    if (!guard.allowed) {
      setOngoingMeetingWarning(guard.reason);
      return;
    }
    setStarting(true);
    try {
      const gps = await captureGps();
      const capturedAt = new Date().toISOString();
      const operationId = uuidv4();
      try {
        await saveDraft({
          clientId,
          agentId: profileId,
          flow,
          payload: {
            operationId,
            mode,
            gpsLat: gps.lat,
            gpsLng: gps.lng,
            capturedAt,
            companions: companionsForDraft(currentVisibleCompanions()),
          },
        });
        setStart({ operationId, capturedAt, gpsLat: gps.lat, gpsLng: gps.lng });
        // From this point on, this JS process "owns" the meeting — leaving
        // and returning to this screen (still the same app run) must never
        // ask again; see lib/meeting-live-session.ts.
        markLiveSession(profileId, clientId);
      } catch (draftErr) {
        console.error('[useMeetingRecordingController] Failed to persist meeting draft:', draftErr);
        setOngoingMeetingWarning(draftErr instanceof OngoingMeetingLimitError ? 'ongoing_meeting' : 'unavailable');
      }
    } catch (err) {
      Alert.alert('Location Error', err instanceof Error ? err.message : 'Failed to get GPS location.');
    } finally {
      setStarting(false);
    }
  }, [clientId, profileId, flow, mode, currentVisibleCompanions]);

  /** For the full form's post-Start GPS retry (AutoCapturedPanel's onRetryLocation) — updates only the fix, never the locked-in start timestamp. */
  const updateStartGps = useCallback((gps: { lat: number; lng: number }): void => {
    setStart((prev) => (prev ? { ...prev, gpsLat: gps.lat, gpsLng: gps.lng } : prev));
  }, []);

  /**
   * 2026-08-04 (Vince direction): re-saves the draft with the current agenda
   * selection so exiting the in-progress screen no longer resets the
   * checklist back to zero on return. Called on every toggle from both
   * screens (a handful of discrete taps per meeting, not a render/timer
   * tick — the "cheap, write-once-on-Start" guidance on `saveDraft` is about
   * avoiding a write-every-render loop, not this). No-ops before Start
   * (`start` unset) since there's nothing to attach the agenda list to yet.
   */
  const updateDraftAgendas = useCallback(
    async (agendas: string[]): Promise<void> => {
      if (!clientId || !profileId || !start) return;
      try {
        await saveDraft({
          clientId,
          agentId: profileId,
          flow,
          payload: {
            operationId: start.operationId,
            mode,
            gpsLat: start.gpsLat,
            gpsLng: start.gpsLng,
            capturedAt: start.capturedAt,
            companions: companionsForDraft(currentVisibleCompanions()),
            agendas,
          },
        });
      } catch (err) {
        console.error('[useMeetingRecordingController] Failed to persist agenda to draft:', err);
      }
    },
    [clientId, profileId, flow, mode, start, currentVisibleCompanions]
  );

  const resumeDraft = useCallback((): void => {
    if (!pendingDraft) return;
    // A draft with companions must not resume until the offline roster query
    // has settled — otherwise the initial empty roster would permanently
    // drop the persisted selections before the picker is available again.
    if ((pendingDraft.payload.companions?.length ?? 0) > 0 && !rosterLoaded) {
      showToast('Loading companion list. Please try Resume again.');
      return;
    }
    if ((pendingDraft.payload.companions?.length ?? 0) > 0 && rosterLoadError) {
      showToast('Unable to load companions. Reopen this meeting and try again.');
      return;
    }
    setMode(pendingDraft.payload.mode);
    setStart({
      operationId: pendingDraft.payload.operationId,
      capturedAt: pendingDraft.payload.capturedAt,
      gpsLat: pendingDraft.payload.gpsLat,
      gpsLng: pendingDraft.payload.gpsLng,
    });
    setSelectedCompanions(restoreCompanionsFromDraft(pendingDraft.payload.companions, visibleRoster));
    setPendingDraft(null);
    // The one required confirmation after a real interruption is done —
    // from here on this process owns the meeting too, same as a fresh
    // Start; further navigate-away-and-back within this run must not ask
    // again.
    if (profileId && clientId) markLiveSession(profileId, clientId);
  }, [pendingDraft, rosterLoaded, rosterLoadError, visibleRoster, profileId, clientId]);

  const discardDraft = useCallback(async (): Promise<void> => {
    if (!clientId) return;
    await deleteDraft(clientId);
    setPendingDraft(null);
    if (profileId) clearLiveSession(profileId, clientId);
  }, [clientId, profileId]);

  /** Called after a successful save — the draft must never survive past it (ADR-026 P1 item 3). Best-effort: a cleanup failure must never surface as a save error. */
  const clearDraft = useCallback(async (): Promise<void> => {
    if (!clientId) return;
    await deleteDraft(clientId).catch((err) =>
      console.error('[useMeetingRecordingController] Failed to clear meeting draft:', err)
    );
    if (profileId) clearLiveSession(profileId, clientId);
  }, [clientId, profileId]);

  /**
   * Explicitly abandons a running meeting. This is intentionally a local
   * SQLite draft delete only: no meeting row or sync/outbox item exists until
   * the agent confirms the end/save action, so cancelling can never submit a
   * partial meeting. Callers own the confirmation dialog and navigation.
   */
  const cancelActiveMeeting = useCallback(async (): Promise<void> => {
    if (!clientId) return;
    await deleteDraft(clientId);
    setStart(null);
    setSelectedCompanions([]);
    setAutoResumeDraft(null);
    setPendingDraft(null);
    setAutoResumedAgendas(null);
    if (profileId) clearLiveSession(profileId, clientId);
  }, [clientId, profileId]);

  const companionSelections: CompanionSelection[] = companionSelectionsForRecording(role, selectedCompanions, visibleRoster);

  // has no counterpart to approve it — those rows insert pre-accepted
  // Historical Manager pre-accepted requests are no longer created.
  return {
    client,
    clientLoading,
    profileId,
    role,
    markSuspended,
    roster,
    rosterLoaded,
    rosterLoadError,
    visibleRoster,
    selectedCompanions,
    toggleCompanion,
    companionSelections,
    mode,
    setMode,
    start,
    starting,
    elapsedSeconds,
    startConfirmOpen,
    ongoingMeetingWarning,
    requestStartMeeting,
    cancelStartMeeting,
    closeOngoingMeetingWarning,
    confirmStartMeeting,
    updateStartGps,
    updateDraftAgendas,
    autoResumedAgendas,
    pendingDraft,
    resumeDraft,
    discardDraft,
    cancelActiveMeeting,
    clearDraft,
  };
}
