import { useEffect, useState } from 'react';
import { Alert, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSQLiteContext } from 'expo-sqlite';
import { router, useLocalSearchParams } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { MapPin } from 'lucide-react-native';
import { Spinner, Text, XStack, YStack } from 'tamagui';
import { useAuth } from '../../../lib/useAuth';
import { captureGps } from '../../../lib/gps';
import { checkConnectivity } from '../../../lib/sync/connectivity';
import { BIZLINK_COLORS, BIZLINK_FONTS, BIZLINK_ON_INK } from '../../../lib/theme';
import { createMeeting } from '../../../lib/meeting-service';
import { buildMeetingRecord } from '../../../lib/meeting-record-assembler';
import { AccountSuspendedError } from '../../../lib/app-lock/account-status';
import { useMeetingRecordingController } from '../../../lib/use-meeting-recording-controller';
import { useClientFlowRoutes } from '../../../lib/use-role-routes';
import { getClientStatus } from '../../../lib/client-status';
import { getVisibleAgendaLabelsForClient } from '../../../lib/meeting-agenda-stage-source';
import { showToast } from '../../../lib/toast';
import { BizTopBar } from '../../../components/bizlink/BizTopBar';
import { BizSectionHeader } from '../../../components/bizlink/BizSectionHeader';
import { BizButton } from '../../../components/bizlink/BizButton';
import { CompanionPicker } from '../../../components/meetings/CompanionPicker';
import { SelectedClientCard } from '../../../components/meetings/SelectedClientCard';
import { MeetingLocationPicker, MEETING_LOCATIONS, type MeetingLocationOption } from '../../../components/meetings/MeetingLocationPicker';
import { AutoCapturedPanel } from '../../../components/meetings/AutoCapturedPanel';
import { AgendaStageNoteCard, type AgendaStage } from '../../../components/meetings/AgendaStageNoteCard';
import { MeetingWrapUpSection } from '../../../components/meetings/MeetingWrapUpSection';
import { LostOpportunityDialog } from '../../../components/meetings/LostOpportunityDialog';
import { PhotoLightbox } from '../../../components/meetings/PhotoLightbox';
import { PoEvidenceCard } from '../../../components/meetings/PoEvidenceCard';
import { DraftResumePrompt } from '../../../components/meetings/DraftResumePrompt';
import { ClientCutoffAllowanceBlock } from '../../../components/cutoff/ClientCutoffAllowanceBlock';
import { StartMeetingConfirmDialog } from '../../../components/meetings/StartMeetingConfirmDialog';
import { isCloseDealPoEligible } from '../../../lib/policies/po-confirmation-status-policy';
import { CLOSE_DEAL_AGENDA, type MeetingOutcome } from '../../../types';

/** mm:ss, matching VisitInProgressPanel's format and the wireframe's `a-visitElapsed`. */
function formatElapsed(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

// Wireframe-Sales-BizLink.html:1581 (see select-client.tsx's identical
// derivation) — reuses the client's already-resolved status rather than
// re-deriving a fast-path/full-form binary. This screen only ever sees
// prospect/in_progress clients (new/existing route to record-visit.tsx).
function recordTitle(status: ReturnType<typeof getClientStatus> | null): string {
  if (status === 'in_progress') return 'Advance Deal';
  return 'Qualify Opportunity';
}

/** This screen only ever sees prospect/in_progress clients — see recordTitle's comment. */
function agendaStageForClient(status: ReturnType<typeof getClientStatus> | null): AgendaStage {
  return status === 'in_progress' ? 'in_progress' : 'prospect';
}

/**
 * Step B (2026-08-02): the client/roster/draft/Start-confirm/companion/
 * elapsed-timer logic previously duplicated here and in `record-visit.tsx`
 * now lives in `lib/use-meeting-recording-controller.ts`. This screen also
 * gained draft crash-recovery for the first time (it previously had none —
 * a force-close after Start lost the start timestamp/GPS/timer/companions
 * entirely) via the same `lib/meeting-drafts.ts` mechanism the fast path
 * already used. Because `MeetingDraftPayload` only ever persists mode/GPS/
 * time/companions, a resumed draft here is necessarily PARTIAL — agenda,
 * outcome, and remarks below are never restored; see
 * `lib/policies/meeting-draft-resume-policy.ts` and
 * `components/meetings/DraftResumePrompt.tsx`'s disclosure copy.
 *
 * Meeting-Flow Wireframe Parity Audit 2026-08-03: reordered to match
 * Wireframe-Sales-BizLink.html's `#a-recordBody`/`#a-recordInProgress`
 * exactly — Meeting location now renders before Start (item 4), the Agenda
 * tiles are stage-aware (item 5), and the selfie capture + final CTA moved
 * to the end of the post-Start flow (item 6). The "Actual contact person"
 * fields and the Complete-Info notice card (items 1-2) were removed — not
 * present in `#a-recordBody`.
 */
export default function RecordMeetingScreen() {
  const insets = useSafeAreaInsets();
  const db = useSQLiteContext();
  const { clientId } = useLocalSearchParams<{ clientId?: string }>();
  const { session } = useAuth();
  const routes = useClientFlowRoutes();

  const controller = useMeetingRecordingController({ clientId, flow: 'full' });
  const {
    client, visibleRoster, profileId, markSuspended,
    selectedCompanions, toggleCompanion, companionSelections, companionsPreAccepted,
    mode, setMode, start, starting, elapsedSeconds, startConfirmOpen,
    requestStartMeeting, cancelStartMeeting, confirmStartMeeting, updateStartGps, updateDraftAgendas,
    pendingDraft, resumeDraft, discardDraft, clearDraft,
  } = controller;

  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [selfiePreviewOpen, setSelfiePreviewOpen] = useState(false);
  const [loadingLocation, setLoadingLocation] = useState(false);

  const [meetingLocation, setMeetingLocation] = useState<MeetingLocationOption>(MEETING_LOCATIONS[0]);
  const [otherLocation, setOtherLocation] = useState('');
  const [selectedAgendas, setSelectedAgendas] = useState<string[]>([]);
  const [remarks, setRemarks] = useState('');
  const [outcome, setOutcome] = useState<MeetingOutcome | null>(null);
  const [lostDialogOpen, setLostDialogOpen] = useState(false);

  // Meeting-Flow Wireframe Parity Audit 2026-08-03 item 5: stage-aware,
  // cycle-coverage-filtered agenda tile labels (lib/meeting-agenda-stage-
  // source.ts) — replaces the raw MEETING_AGENDAS constant this screen used
  // to hand MeetingWrapUpSection directly.
  const [agendaOptions, setAgendaOptions] = useState<string[]>([]);
  const [agendaOptionsLoading, setAgendaOptionsLoading] = useState(true);
  const [agendaOptionsError, setAgendaOptionsError] = useState(false);

  // ADR-044/046 point 7: PO evidence for an In Progress client's 'Close
  // deal' agenda — capture-only here (camera, no gallery); the actual
  // capture/submit split happens in createMeeting() (lib/meeting-service.ts).
  const [poPhotoUri, setPoPhotoUri] = useState<string | null>(null);
  const [capturingPoPhoto, setCapturingPoPhoto] = useState(false);

  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!client) {
      setAgendaOptions([]);
      setAgendaOptionsLoading(false);
      return;
    }
    let cancelled = false;
    setAgendaOptionsLoading(true);
    setAgendaOptionsError(false);
    const stage = agendaStageForClient(getClientStatus(client));
    getVisibleAgendaLabelsForClient(db, { clientId: client.id, cycleId: client.cycle_id ?? null, stage })
      .then((labels) => {
        if (!cancelled) setAgendaOptions(labels);
      })
      .catch((err) => {
        console.error('[RecordMeeting] Failed to resolve stage-aware agenda list:', err);
        if (!cancelled) {
          setAgendaOptions([]);
          setAgendaOptionsError(true);
        }
      })
      .finally(() => {
        if (!cancelled) setAgendaOptionsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [db, client]);

  async function captureLocation(): Promise<void> {
    setLoadingLocation(true);
    try {
      const gps = await captureGps();
      updateStartGps(gps);
    } catch (err) {
      Alert.alert('Location Error', err instanceof Error ? err.message : 'Failed to get GPS location.');
    } finally {
      setLoadingLocation(false);
    }
  }

  async function captureSelfie() {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission denied', 'Camera permission is required for selfie capture.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.7,
      allowsEditing: false,
    });
    if (!result.canceled && result.assets.length > 0) {
      setPhotoUri(result.assets[0].uri);
    }
  }

  function toggleAgenda(agenda: string) {
    const next = selectedAgendas.includes(agenda)
      ? selectedAgendas.filter((a) => a !== agenda)
      : [...selectedAgendas, agenda];
    // Wireframe `aTogglePoEvidence()`: deselecting 'Close deal' clears any
    // already-attached PO photo, same as the demo's `aPoEvidenceConfirmed=false`.
    if (agenda === CLOSE_DEAL_AGENDA && !next.includes(CLOSE_DEAL_AGENDA)) setPoPhotoUri(null);
    setSelectedAgendas(next);
    void updateDraftAgendas(next);
  }

  async function capturePoPhoto() {
    setCapturingPoPhoto(true);
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission denied', 'Camera permission is required for PO evidence capture.');
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.7,
        allowsEditing: false,
      });
      if (!result.canceled && result.assets.length > 0) {
        setPoPhotoUri(result.assets[0].uri);
        showToast('PO evidence attached. Manager approval is still required.');
      }
    } finally {
      setCapturingPoPhoto(false);
    }
  }

  function selectOutcome(next: MeetingOutcome) {
    if (next === 'Lost Opportunity') {
      setLostDialogOpen(true);
      return;
    }
    setOutcome(next);
  }

  async function doSave() {
    if (!start) {
      Alert.alert('Start Meeting Required', 'Tap Start meeting to lock GPS + timestamp before saving.');
      return;
    }
    if (!photoUri) {
      Alert.alert('Selfie Required', 'Please capture a selfie before saving.');
      return;
    }
    if (!outcome) {
      Alert.alert('Outcome Required', 'Please select a meeting outcome.');
      return;
    }
    if (poPhotoUri && client?.status === 'in_progress' && !client.cycle_id) {
      // ADR-044: po_confirmation_requests.cycle_id is NOT NULL — without a
      // synced-down cycle_id the request can't be submitted at all. Block
      // rather than silently drop the captured evidence.
      Alert.alert(
        'Sync Required',
        'This client’s current cycle hasn’t synced to this device yet. Sync online, then try again before saving with PO evidence.'
      );
      return;
    }
    if (!session || !profileId) {
      Alert.alert('Not signed in', 'Sign in again before recording a meeting.');
      return;
    }
    if (!clientId) {
      Alert.alert('Client Required', 'Select a client from the client picker before recording a meeting.');
      return;
    }

    setSaving(true);
    try {
      // T-014 Phase C (ADR-026 P1 item 4): the photo is no longer uploaded
      // in the foreground at all — the meeting saves with the local
      // `file://` selfie URI immediately, and `createMeeting()` queues its
      // upload internally (`photoToQueue`) right after the local insert
      // commits. Storage path convention keys by the Auth uid (matches
      // Storage RLS' `auth.uid()` check) — deliberately session.user.id,
      // not profileId.
      const meetingId = await createMeeting(
        buildMeetingRecord({
          flow: 'full',
          clientId,
          agentId: profileId,
          authUserId: session.user.id,
          start,
          mode,
          agendas: selectedAgendas,
          companions: companionSelections,
          companionsPreAccepted,
          selfieUri: photoUri,
          outcome,
          // Meeting-Flow Wireframe Parity Audit 2026-08-03 item 1: the
          // "Actual contact person" fields aren't in the wireframe's
          // `#a-recordBody` — no longer collected on this screen.
          contactName: '',
          contactPosition: '',
          meetingLocation,
          otherLocation,
          remarks,
          // ADR-046 point 2 / Wireframe-Sales-BizLink.html:2152 (`poRequestPending`):
          // a Successful outcome is required alongside 'in_progress' + Close
          // deal — isCloseDealPoEligible() also enforces this. Fast Visit
          // (record-visit.tsx) can never satisfy this gate at all: it sends
          // `outcome: null` structurally (its BuildVisitMeetingRecordInput
          // has no outcome field), so PO evidence can only ever originate
          // from THIS flow. See finishMeeting()'s doc comment in
          // record-visit.tsx for the full "not a bug" explanation.
          poEvidence:
            poPhotoUri && client?.cycle_id && isCloseDealPoEligible(client?.status, outcome, selectedAgendas)
              ? { localPhotoUri: poPhotoUri, cycleId: client.cycle_id }
              : null,
        })
      );
      await clearDraft();
      const connectivity = await checkConnectivity();
      router.replace(routes.celebrate(connectivity === 'online', meetingId, clientId));
    } catch (err) {
      if (err instanceof AccountSuspendedError) {
        // Batch 5 Slice 2 (ADR-051): route to AccountSuspendedScreen instead
        // of showing a generic save error — never swallow this silently.
        markSuspended();
        return;
      }
      // PostgrestError isn't an Error instance — log the raw object (code/
      // details/hint) so on-device debugging isn't limited to err.message.
      console.error('[RecordMeeting] Save Error:', JSON.stringify(err, null, 2));
      const message = err instanceof Error ? err.message : (err as { message?: string })?.message ?? 'Failed to save the meeting.';
      Alert.alert('Save Error', message);
    } finally {
      setSaving(false);
    }
  }

  const agendaStage = agendaStageForClient(client ? getClientStatus(client) : null);
  const actionName = recordTitle(client ? getClientStatus(client) : null);

  return (
    <YStack flex={1} backgroundColor={BIZLINK_COLORS.canvas} paddingTop={insets.top}>
      <BizTopBar title={actionName} />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32 }}>
        <SelectedClientCard clientName={client?.company_name ?? null} status={client ? getClientStatus(client) : null} />

        <CompanionPicker
          roster={visibleRoster}
          selected={selectedCompanions}
          onToggle={toggleCompanion}
        />

        {/* Wireframe-Sales-BizLink.html:688-695 — "Meeting location" is the
            first thing inside #a-recordBody, ABOVE #a-recordBeforeStart's
            Start button, not gated behind `start` truthiness. */}
        <MeetingLocationPicker
          value={meetingLocation}
          onChange={(loc) => {
            setMeetingLocation(loc);
            // Wireframe-Sales-BizLink.html:1766 —
            // `aSetMeetingMode(kind==='online'?'online':'in_person')`.
            setMode(loc === 'Online' ? 'online' : 'in_person');
          }}
          otherLocation={otherLocation}
          onOtherLocationChange={setOtherLocation}
        />

        {pendingDraft ? (
          <DraftResumePrompt
            draft={pendingDraft}
            onResume={() => {
              // Agenda lives in this screen's own state (not the
              // controller), so it's restored here alongside resumeDraft()
              // restoring mode/start/companions — same draft, one tap.
              setSelectedAgendas(pendingDraft.payload.agendas ?? []);
              resumeDraft();
            }}
            onDiscard={() => {
              void discardDraft();
            }}
          />
        ) : !start ? (
          <YStack marginTop="$4" gap="$4">
            {/* W-2 (ADR-053): pre-start allowance line — renders nothing for prospect/in_progress, when flag is off, or when unconfigured. */}
            <ClientCutoffAllowanceBlock client={client} compact />
            <BizSectionHeader title="Start meeting" />
            <YStack backgroundColor={BIZLINK_COLORS.ink} borderRadius={24} padding={16}>
              <XStack alignItems="center" gap="$3">
                <YStack width={44} height={44} borderRadius={14} backgroundColor={BIZLINK_ON_INK.circleFill} alignItems="center" justifyContent="center">
                  <MapPin size={18} color={BIZLINK_COLORS.card} strokeWidth={1.75} />
                </YStack>
                <YStack flex={1}>
                  <Text fontSize={12.5} fontFamily={BIZLINK_FONTS.semibold} color={BIZLINK_COLORS.card}>GPS will be captured on Start</Text>
                  <Text fontSize={11} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_ON_INK.textMuted}>
                    Start asks for location permission if needed.
                  </Text>
                </YStack>
              </XStack>
            </YStack>
            <BizButton label={starting ? 'Capturing GPS…' : 'Start meeting'} onPress={requestStartMeeting} disabled={starting} />
            <Text fontSize={12} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted} textAlign="center">
              Picture ay kukunin lang sa dulo, kasabay ng Save Meeting.
            </Text>
          </YStack>
        ) : (
          <>
            <YStack backgroundColor={BIZLINK_COLORS.tintA} borderRadius={20} padding={14} marginTop="$4">
              <Text fontSize={12.5} fontFamily={BIZLINK_FONTS.semibold} color={BIZLINK_COLORS.ink}>
                Meeting in progress — nagsimula {new Date(start.capturedAt).toLocaleTimeString()} · {formatElapsed(elapsedSeconds)}
              </Text>
            </YStack>

            <MeetingWrapUpSection
              agendaOptions={agendaOptions}
              selectedAgendas={selectedAgendas}
              onToggleAgenda={toggleAgenda}
              agendaNote={<AgendaStageNoteCard stage={agendaStage} loading={agendaOptionsLoading} error={agendaOptionsError} />}
              remarks={remarks}
              onRemarksChange={setRemarks}
              outcome={outcome}
              onSelectOutcome={selectOutcome}
              afterAgenda={
                <PoEvidenceCard
                  // Wireframe-Sales-BizLink.html:701's `aTogglePoEvidence(this)` gates
                  // the card's visibility purely on the Close-deal tile's own
                  // selection state (agenda tiles render ABOVE Outcome in both the
                  // wireframe and MeetingWrapUpSection's layout) — outcome is only
                  // read later, in the `poRequestPending` calc at line 2152, which
                  // gates the actual PO *submission*, not this card's visibility.
                  // Gating `visible` on outcome too would show/hide this card based
                  // on a field the agent hasn't reached yet in the scroll order,
                  // which is a real UX regression, not just a cosmetic deviation —
                  // see isCloseDealPoEligible's use in the poEvidence trigger above
                  // for where the outcome check actually belongs.
                  visible={client?.status === 'in_progress' && selectedAgendas.includes(CLOSE_DEAL_AGENDA)}
                  photoUri={poPhotoUri}
                  capturing={capturingPoPhoto}
                  onCapture={capturePoPhoto}
                />
              }
            />

            {/* Meeting-Flow Wireframe Parity Audit 2026-08-03 item 6: the
                selfie capture panel moved from mid-flow (right after Start)
                to here — immediately before the final CTA, matching
                Wireframe-Sales-BizLink.html:739-740's "End photo" block
                placement (after Remarks/Outcome, right before
                `aSaveMeeting()`). Same capture handler/GPS retry/preview —
                only the position changed. */}
            <AutoCapturedPanel
              loadingLocation={loadingLocation}
              location={{ lat: start.gpsLat, lng: start.gpsLng }}
              photoUri={photoUri}
              onOpenCamera={captureSelfie}
              onPreviewPress={() => setSelfiePreviewOpen(true)}
              onRetryLocation={captureLocation}
            />

            <YStack marginTop="$5">
              {/* Wireframe-Sales-BizLink.html:1731 (aRenderRecordStage): the
                  static "End meeting, take photo" markup on #a-recordSaveBtn
                  is overwritten to "Save "+actionName the moment a client is
                  selected and never reset — the wireframe's actual runtime
                  label is always status-aware, not the placeholder text. */}
              <BizButton label={saving ? 'Saving…' : `Save ${actionName}`} onPress={doSave} disabled={saving} />
            </YStack>
            <XStack justifyContent="center" marginTop="$2.5">
              {saving ? <Spinner color={BIZLINK_COLORS.brand} /> : null}
            </XStack>
            <Text fontSize={12} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted} textAlign="center" marginTop="$2">
              Gagana kahit walang signal — mase-save locally, auto-sync mamaya.
            </Text>
          </>
        )}
      </ScrollView>

      <LostOpportunityDialog
        visible={lostDialogOpen}
        onCancel={() => setLostDialogOpen(false)}
        onConfirm={() => {
          setOutcome('Lost Opportunity');
          setLostDialogOpen(false);
        }}
      />

      <PhotoLightbox uri={photoUri} visible={selfiePreviewOpen} onClose={() => setSelfiePreviewOpen(false)} />

      <StartMeetingConfirmDialog
        visible={startConfirmOpen}
        onCancel={cancelStartMeeting}
        onConfirm={() => {
          void confirmStartMeeting();
        }}
      />
    </YStack>
  );
}
