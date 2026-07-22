import { useEffect, useState } from 'react';
import { Alert, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Spinner, Text, YStack } from 'tamagui';
import { useAuth } from '../../../lib/useAuth';
import { useSession } from '../../../lib/session-store';
import { getClientById } from '../../../lib/client-service';
import { createMeeting } from '../../../lib/meeting-service';
import { saveDraft, getDraftForClient, deleteDraft, type MeetingDraft } from '../../../lib/meeting-drafts';
import { getTeamRoster, inviteeKindForRole } from '../../../lib/team-roster';
import { MAX_COMPANIONS_PER_REQUEST } from '../../../lib/tag-along-service';
import { useElapsedTimer } from '../../../lib/use-elapsed-timer';
import { captureGps } from '../../../lib/gps';
import { checkConnectivity } from '../../../lib/sync/connectivity';
import { showToast } from '../../../lib/toast';
import { BIZLINK_COLORS, BIZLINK_FONTS } from '../../../lib/theme';
import { BizTopBar } from '../../../components/bizlink/BizTopBar';
import { BizButton } from '../../../components/bizlink/BizButton';
import { ClientInfoCard } from '../../../components/clients/ClientInfoCard';
import { VisitStartPanel } from '../../../components/meetings/VisitStartPanel';
import { VisitInProgressPanel } from '../../../components/meetings/VisitInProgressPanel';
import { type CapturedPhoto } from '../../../components/meetings/PhotoCapture';
import { DraftResumePrompt } from '../../../components/meetings/DraftResumePrompt';
import type { Client, MeetingMode, TeamRosterEntry } from '../../../types';

interface StartCapture {
  capturedAt: string;
  gpsLat: number;
  gpsLng: number;
}

/**
 * Existing-client fast path (revises ADR-015, 2026-07-16): select client →
 * Start button (GPS + timestamp only, no photo) → meeting (agenda ticks) →
 * end photo (photo + GPS + timestamp, as before). No form re-fill — client
 * info is display-only. Admin (web) manually validates the meeting by
 * matching the Start GPS to the End photo's GPS; duration is computed
 * web-side from the two timestamps, never here.
 *
 * Live elapsed timer (Wireframe `id="a-visitElapsed"`, `aVisitTick()`) and
 * the End Photo agenda-gate (`#a-visitEndBtn disabled` +
 * `#a-visitAgendaGateNote`) are both implemented below — pure UI-feedback,
 * the timer itself is never persisted (real duration calc stays server-side
 * per the wireframe's own footer note).
 */
export default function RecordVisitScreen() {
  const insets = useSafeAreaInsets();
  const { clientId } = useLocalSearchParams<{ clientId: string }>();
  const { session } = useAuth();
  const { profileId, role } = useSession();

  const [client, setClient] = useState<Client | null>(null);
  const [loading, setLoading] = useState(true);
  const [roster, setRoster] = useState<TeamRosterEntry[]>([]);
  const [selectedCompanions, setSelectedCompanions] = useState<TeamRosterEntry[]>([]);
  const [mode, setMode] = useState<MeetingMode>('in_person');
  const [starting, setStarting] = useState(false);
  const [start, setStart] = useState<StartCapture | null>(null);
  const [selectedAgendas, setSelectedAgendas] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  // ADR-026 P1 item 3 (Meeting Draft Recovery): a same-day draft found for
  // this client on mount — resume/discard prompt gates the normal Start
  // button until the agent picks one.
  const [pendingDraft, setPendingDraft] = useState<MeetingDraft | null>(null);

  const elapsedSeconds = useElapsedTimer(start?.capturedAt ?? null);

  // Local SQLite is the primary read path (ADR-001/T-003). Also checks for a
  // same-day draft (ADR-026 P1 item 3) — a client that no longer exists
  // locally (e.g. removed by the lost/deleted sync-down fix,
  // lib/sync/entity-appliers.ts) silently discards any orphaned draft
  // instead of ever offering to resume it.
  useEffect(() => {
    if (!clientId) return;
    let cancelled = false;
    (async () => {
      const foundClient = await getClientById(clientId);
      if (cancelled) return;
      if (!foundClient) {
        Alert.alert('Error', 'Client not found.');
        // Best-effort cleanup — a transient SQLite error here must never
        // strand the screen on its loading spinner (the Alert has already
        // fired regardless of whether the delete succeeds).
        await deleteDraft(clientId).catch((err) =>
          console.error('[RecordVisit] Failed to discard orphaned draft:', err)
        );
        setLoading(false);
        return;
      }
      setClient(foundClient);
      if (profileId) {
        const draft = await getDraftForClient(clientId, profileId);
        if (!cancelled) setPendingDraft(draft);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [clientId, profileId]);

  // ADR-030 Pass 2.5: same "Kasama sa visit" companion picker as the
  // prospect/new full-form path (record.tsx) — the existing-client fast
  // path was missing it entirely, even though tag-along applies regardless
  // of client status.
  useEffect(() => {
    getTeamRoster().then(setRoster);
  }, []);

  function toggleCompanion(entry: TeamRosterEntry): void {
    setSelectedCompanions((prev) => {
      const alreadySelected = prev.some((p) => p.profileId === entry.profileId);
      if (alreadySelected) return prev.filter((p) => p.profileId !== entry.profileId);
      if (prev.length >= MAX_COMPANIONS_PER_REQUEST) {
        showToast('Hanggang 2 kasama lang ang pwede');
        return prev;
      }
      return [...prev, entry];
    });
  }

  function resumeDraft(): void {
    if (!pendingDraft) return;
    setMode(pendingDraft.payload.mode);
    setStart({
      capturedAt: pendingDraft.payload.capturedAt,
      gpsLat: pendingDraft.payload.gpsLat,
      gpsLng: pendingDraft.payload.gpsLng,
    });
    setPendingDraft(null);
  }

  async function discardDraft(): Promise<void> {
    if (!clientId) return;
    await deleteDraft(clientId);
    setPendingDraft(null);
  }

  function toggleAgenda(agenda: string): void {
    setSelectedAgendas((prev) =>
      prev.includes(agenda) ? prev.filter((a) => a !== agenda) : [...prev, agenda]
    );
  }

  /**
   * Starts the meeting: GPS + timestamp only, no photo (2026-07-16 revision).
   * Also persists a draft (ADR-026 P1 item 3) so this GPS+timestamp lock —
   * which can't be recreated with integrity by just re-tapping Start —
   * survives an app crash/kill before the end photo is taken. The draft
   * write is best-effort: a failure here logs but never blocks the meeting
   * itself from starting.
   */
  async function startMeeting(): Promise<void> {
    if (!clientId || !profileId) return;
    setStarting(true);
    try {
      const gps = await captureGps();
      const capturedAt = new Date().toISOString();
      setStart({ capturedAt, gpsLat: gps.lat, gpsLng: gps.lng });
      try {
        await saveDraft({
          clientId,
          agentId: profileId,
          flow: 'visit',
          payload: { mode, gpsLat: gps.lat, gpsLng: gps.lng, capturedAt },
        });
      } catch (draftErr) {
        console.error('[RecordVisit] Failed to persist meeting draft:', draftErr);
      }
    } catch (err) {
      Alert.alert('Location Error', err instanceof Error ? err.message : 'Failed to get GPS location.');
    } finally {
      setStarting(false);
    }
  }

  async function finishMeeting(endPhoto: CapturedPhoto): Promise<void> {
    if (!start || !session || !profileId) return;
    setSaving(true);
    try {
      // T-014 Phase C (ADR-026 P1 item 4): the end photo is no longer
      // uploaded in the foreground at all — the meeting saves with the
      // local `file://` URI immediately, and `createMeeting()` queues its
      // upload internally (`photoToQueue`) right after the local insert
      // commits. `meeting-service.ts`'s `remoteMediaUrl()` still nulls out
      // this local URI before it ever reaches the initial remote insert;
      // the queued upload's own patch (lib/sync/photo-uploads.ts) is what
      // sets the real Storage URL once it's actually uploaded. Storage path
      // convention keys by the Auth uid (matches Storage RLS' `auth.uid()`
      // check) — deliberately session.user.id, not profileId.
      await createMeeting({
        client_id: clientId ?? null,
        agent_id: profileId,
        gps_lat: start.gpsLat,
        gps_lng: start.gpsLng,
        meeting_mode: mode,
        agendas: selectedAgendas,
        outcome: null,
        start_captured_at: start.capturedAt,
        end_photo_url: endPhoto.uri,
        end_captured_at: endPhoto.capturedAt,
        end_gps_lat: endPhoto.gpsLat,
        end_gps_lng: endPhoto.gpsLng,
        logged_at: start.capturedAt,
        photoToQueue: { kind: 'end', localUri: endPhoto.uri, userId: session.user.id },
        companions: selectedCompanions.map((entry) => ({
          profileId: entry.profileId,
          kind: inviteeKindForRole(entry.role),
        })),
        // F-205 decision 2 (quality-gate fix): mirrors record.tsx exactly —
        // this fast path was missed when the picker was added to
        // record-visit.tsx (Pass 2.5 Completeness Fix), leaving a manager's
        // own companion requests here landing as normal PENDING rows
        // (requester_id = the manager, same as any other requester) with no
        // counterpart able to approve them. Role-based so it stays correct
        // regardless of which route renders this shared screen.
        companionsPreAccepted: role === 'sales_manager',
      });
      // The draft must never survive past a successful save (ADR-026 P1 item
      // 3) — best-effort: a cleanup failure here shouldn't surface as a save
      // error, since the meeting itself already saved successfully.
      if (clientId) {
        await deleteDraft(clientId).catch((cleanupErr) =>
          console.error('[RecordVisit] Failed to clear meeting draft:', cleanupErr)
        );
      }
      const connectivity = await checkConnectivity();
      router.replace(`/(tabs)/meetings/celebrate?online=${connectivity === 'online'}`);
    } catch (err) {
      console.error('[RecordVisit] Save Error:', JSON.stringify(err, null, 2));
      const message = err instanceof Error ? err.message : (err as { message?: string })?.message ?? 'Failed to save the meeting.';
      Alert.alert('Save Error', message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <YStack flex={1} justifyContent="center" alignItems="center" backgroundColor={BIZLINK_COLORS.canvas}>
        <Spinner size="large" color={BIZLINK_COLORS.brand} />
      </YStack>
    );
  }

  if (!client) {
    return (
      <YStack flex={1} justifyContent="center" alignItems="center" padding="$6" backgroundColor={BIZLINK_COLORS.canvas} gap="$3">
        <Text fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.text}>Client not found.</Text>
        <BizButton label="Go back" variant="white" onPress={() => router.back()} />
      </YStack>
    );
  }

  return (
    <YStack flex={1} backgroundColor={BIZLINK_COLORS.canvas} paddingTop={insets.top}>
      <BizTopBar title={`Meeting — ${client.company_name}`} />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32 }}>
        <ClientInfoCard client={client} />

        {pendingDraft ? (
          <DraftResumePrompt
            draft={pendingDraft}
            onResume={resumeDraft}
            onDiscard={() => {
              void discardDraft();
            }}
          />
        ) : !start ? (
          <VisitStartPanel
            roster={roster}
            selectedCompanions={selectedCompanions}
            onToggleCompanion={toggleCompanion}
            mode={mode}
            onModeChange={setMode}
            starting={starting}
            onStart={startMeeting}
          />
        ) : (
          <VisitInProgressPanel
            startedAt={start.capturedAt}
            elapsedSeconds={elapsedSeconds}
            selectedAgendas={selectedAgendas}
            onToggleAgenda={toggleAgenda}
            saving={saving}
            onConfirm={finishMeeting}
          />
        )}
      </ScrollView>
    </YStack>
  );
}
