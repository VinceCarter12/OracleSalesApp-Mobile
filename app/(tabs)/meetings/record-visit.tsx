import { useState } from 'react';
import { Alert, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Spinner, Text, YStack } from 'tamagui';
import { useAuth } from '../../../lib/useAuth';
import { createMeeting } from '../../../lib/meeting-service';
import { buildMeetingRecord } from '../../../lib/meeting-record-assembler';
import { AccountSuspendedError } from '../../../lib/app-lock/account-status';
import { useMeetingRecordingController } from '../../../lib/use-meeting-recording-controller';
import { getClientStatus } from '../../../lib/client-status';
import { useClientFlowRoutes } from '../../../lib/use-role-routes';
import { checkConnectivity } from '../../../lib/sync/connectivity';
import { BIZLINK_COLORS, BIZLINK_FONTS } from '../../../lib/theme';
import { BizTopBar } from '../../../components/bizlink/BizTopBar';
import { BizButton } from '../../../components/bizlink/BizButton';
import { SelectedClientCard } from '../../../components/meetings/SelectedClientCard';
import { VisitStartPanel } from '../../../components/meetings/VisitStartPanel';
import { VisitInProgressPanel } from '../../../components/meetings/VisitInProgressPanel';
import { type CapturedPhoto } from '../../../components/meetings/PhotoCapture';
import { DraftResumePrompt } from '../../../components/meetings/DraftResumePrompt';
import { StartMeetingConfirmDialog } from '../../../components/meetings/StartMeetingConfirmDialog';

/**
 * Existing-client fast path (revises ADR-015, 2026-07-16): select client →
 * Start button (GPS + timestamp only, no photo) → meeting (agenda ticks) →
 * end photo (photo + GPS + timestamp, as before). No form re-fill — client
 * info is display-only. Admin (web) manually validates the meeting by
 * matching the Start GPS to the End photo's GPS; duration is computed
 * web-side from the two timestamps, never here.
 *
 * Step B (2026-08-02): the client/roster/draft/Start-confirm/companion/
 * elapsed-timer logic previously duplicated here and in `record.tsx` now
 * lives in `lib/use-meeting-recording-controller.ts`. Fast-path never
 * collects an outcome — `outcome: null` below, handled by the assembler —
 * so Close Deal / PO evidence is structurally impossible on this screen; see
 * the comment on `finishMeeting()` for why that is intentional, not a gap.
 */
// Wireframe-Sales-BizLink.html:749 (`<span id="a-visitActionName">Customer
// Visit</span> — <span id="a-visitClientName">—</span>`) plus
// select-client.tsx's `recordPickerHint()` ('New Customer Visit' / 'Existing
// Customer Visit') — this screen only ever sees new/existing clients
// (prospect/in_progress route to record.tsx).
function visitActionName(status: ReturnType<typeof getClientStatus>): string {
  return status === 'new' ? 'New Customer Visit' : 'Existing Customer Visit';
}

export default function RecordVisitScreen() {
  const insets = useSafeAreaInsets();
  const { clientId } = useLocalSearchParams<{ clientId: string }>();
  const { session } = useAuth();
  const routes = useClientFlowRoutes();

  const controller = useMeetingRecordingController({ clientId, flow: 'visit' });
  const {
    client, clientLoading, profileId, markSuspended, visibleRoster,
    selectedCompanions, toggleCompanion, companionSelections, companionsPreAccepted,
    mode, setMode, start, starting, elapsedSeconds, startConfirmOpen,
    requestStartMeeting, cancelStartMeeting, confirmStartMeeting, updateDraftAgendas,
    pendingDraft, resumeDraft, discardDraft, clearDraft,
  } = controller;

  const [selectedAgendas, setSelectedAgendas] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  function toggleAgenda(agenda: string): void {
    const next = selectedAgendas.includes(agenda)
      ? selectedAgendas.filter((a) => a !== agenda)
      : [...selectedAgendas, agenda];
    setSelectedAgendas(next);
    void updateDraftAgendas(next);
  }

  /**
   * Fast Visit is a routine quick-visit path only — it structurally never
   * collects a meeting outcome (`outcome: null` below, always). Close Deal /
   * PO confirmation therefore requires the full Record Meeting flow
   * (`record.tsx`), the only flow that asks for an outcome at all —
   * `isCloseDealPoEligible()` (lib/policies/po-confirmation-status-policy.ts)
   * requires `outcome === 'Successful'`, which this screen can never supply.
   * Confirmed 2026-08-02: not a bug, no PO-evidence UI is added here.
   */
  async function finishMeeting(endPhoto: CapturedPhoto): Promise<void> {
    if (!start || !session || !profileId || !clientId) return;
    setSaving(true);
    try {
      const meetingId = await createMeeting(
        buildMeetingRecord({
          flow: 'visit',
          clientId,
          agentId: profileId,
          authUserId: session.user.id,
          start,
          mode,
          agendas: selectedAgendas,
          companions: companionSelections,
          companionsPreAccepted,
          endPhoto: {
            uri: endPhoto.uri,
            capturedAt: endPhoto.capturedAt,
            gpsLat: endPhoto.gpsLat,
            gpsLng: endPhoto.gpsLng,
          },
        })
      );
      // The draft must never survive past a successful save (ADR-026 P1 item
      // 3) — best-effort: a cleanup failure here shouldn't surface as a save
      // error, since the meeting itself already saved successfully.
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
      console.error('[RecordVisit] Save Error:', JSON.stringify(err, null, 2));
      const message = err instanceof Error ? err.message : (err as { message?: string })?.message ?? 'Failed to save the meeting.';
      Alert.alert('Save Error', message);
    } finally {
      setSaving(false);
    }
  }

  if (clientLoading) {
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
      <BizTopBar title={`${visitActionName(getClientStatus(client))} — ${client.company_name}`} />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32 }}>
        <SelectedClientCard clientName={client.company_name} status={getClientStatus(client)} />

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
          <VisitStartPanel
            client={client}
            roster={visibleRoster}
            selectedCompanions={selectedCompanions}
            onToggleCompanion={toggleCompanion}
            mode={mode}
            onModeChange={setMode}
            starting={starting}
            onStart={requestStartMeeting}
            actionName={visitActionName(getClientStatus(client))}
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
