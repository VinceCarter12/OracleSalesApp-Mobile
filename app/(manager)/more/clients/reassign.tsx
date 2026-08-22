import { useCallback, useEffect, useState } from 'react';
import { ScrollView, TextInput } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { Spinner, Text, XStack, YStack } from 'tamagui';
import { KeyboardAwareScrollView } from '../../../../components/ui/KeyboardAwareScrollView';
import { ChevronRight } from 'lucide-react-native';
import { BIZLINK_COLORS, BIZLINK_FONTS } from '../../../../lib/theme';
import { useSession } from '../../../../lib/session-store';
import { useTeamOverview } from '../../../../lib/use-team-overview';
import { avatarPaletteFor } from '../../../../lib/avatar-palette';
import { isLikelyOnline } from '../../../../lib/sync/connectivity';
import {
  fetchTeamReassignCandidates,
  reassignTeamClient,
  ReassignConflictError,
  type TeamAgentOption,
} from '../../../../lib/manager-client-service';
import { isReassignSuccess, mapReassignResponseCode } from '../../../../lib/policies/reassignment-response-policy';
import { BizTopBar } from '../../../../components/bizlink/BizTopBar';
import { BizButton } from '../../../../components/bizlink/BizButton';
import { Avatar } from '../../../../components/ui/Avatar';

/** Wireframe s-reassign — pick a new agent, writes a real reassignment (B-054 Phase 1, Migration 022). */
export default function ReassignClientScreen() {
  const insets = useSafeAreaInsets();
  const { clientId } = useLocalSearchParams<{ clientId: string }>();
  const { teamId } = useSession();
  const { overview, loading: overviewLoading, error: overviewError, reload: reloadOverview } = useTeamOverview();

  const [candidates, setCandidates] = useState<TeamAgentOption[]>([]);
  const [candidatesLoading, setCandidatesLoading] = useState(true);
  const [candidatesError, setCandidatesError] = useState<string | null>(null);
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [online, setOnline] = useState(true);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // 2026-08-22 (corrected same day, Vince): a holder CAN reassign a held
  // client — the earlier "explicit guard, never resolves guestClients" rule
  // was reversed after device testing. A holder now gets the same
  // functionality a team manager has for their own team's clients,
  // including reassignment — the one constraint (enforced server-side by
  // migration 125's widened `reassign_team_client()`) is that the
  // destination must be one of the CALLER's own team agents, never an
  // arbitrary agent elsewhere. `fetchTeamReassignCandidates(teamId, ...)`
  // below already only ever lists the caller's own team, so no client-side
  // change is needed there — this fix is purely about no longer refusing to
  // resolve a guest-held client in the first place.
  const client = overview?.clients.find((c) => c.id === clientId) ?? overview?.guestClients.find((c) => c.id === clientId);
  const isHeldGuestClient = client?.isGuestRecord === true;

  const loadCandidates = useCallback(async () => {
    if (!teamId || !client) return;
    setCandidatesLoading(true);
    setCandidatesError(null);
    try {
      const [result, isOnline] = await Promise.all([
        fetchTeamReassignCandidates(teamId, client.agentId),
        isLikelyOnline(),
      ]);
      setCandidates(result);
      setOnline(isOnline);
    } catch (err) {
      console.error('[reassign] load candidates failed:', err instanceof Error ? err.message : String(err));
      setCandidatesError("The agents list couldn't be loaded.");
    } finally {
      setCandidatesLoading(false);
    }
  }, [teamId, client]);

  useEffect(() => {
    loadCandidates();
  }, [loadCandidates]);

  useFocusEffect(
    useCallback(() => {
      loadCandidates();
    }, [loadCandidates])
  );

  async function confirm(): Promise<void> {
    if (!selectedAgentId || !client || !reason.trim()) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const result = await reassignTeamClient({
        clientId: client.id,
        fromAgentProfileId: client.agentId,
        toAgentProfileId: selectedAgentId,
        reason: reason.trim(),
      });
      if (isReassignSuccess(result.code)) {
        router.replace(`/(manager)/more/clients/${encodeURIComponent(client.id)}`);
        return;
      }
      setSubmitError(mapReassignResponseCode(result.code));
    } catch (err) {
      if (err instanceof ReassignConflictError) {
        setSubmitError('This client was already moved to another agent — refresh and try again.');
      } else {
        setSubmitError(err instanceof Error ? err.message : "The client couldn't be reassigned. Try again.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (overviewLoading) {
    return (
      <YStack flex={1} justifyContent="center" alignItems="center" backgroundColor={BIZLINK_COLORS.canvas}>
        <Spinner size="large" color={BIZLINK_COLORS.brand} />
      </YStack>
    );
  }

  if (overviewError) {
    return (
      <YStack flex={1} justifyContent="center" alignItems="center" backgroundColor={BIZLINK_COLORS.canvas} gap="$3" paddingHorizontal="$5">
        <Text fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted} textAlign="center">{overviewError}</Text>
        <BizButton small label="Ulitin" variant="white" onPress={reloadOverview} />
      </YStack>
    );
  }

  if (!client) {
    return (
      <YStack flex={1} justifyContent="center" alignItems="center" backgroundColor={BIZLINK_COLORS.canvas} paddingHorizontal="$5">
        <Text fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted} textAlign="center">Client not found.</Text>
      </YStack>
    );
  }

  // B-133 follow-up: a held client's current owner is never in
  // `overview.agents` (own team roster only) — same fallback pattern as
  // the Client Detail / Meeting Detail fixes.
  const currentAgent = overview?.agents.find((a) => a.id === client.agentId)
    ?? (isHeldGuestClient && client.guestOwnerAgentName
      ? { id: client.agentId, name: client.guestOwnerAgentName }
      : undefined);

  return (
    <YStack flex={1} backgroundColor={BIZLINK_COLORS.canvas} paddingTop={insets.top}>
      <BizTopBar title="Reassign Client" fallbackHref={`/(manager)/more/clients/${encodeURIComponent(clientId)}`} />
      <KeyboardAwareScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}>
        <YStack backgroundColor={BIZLINK_COLORS.card} borderRadius={20} padding={14} marginBottom="$3.5">
          <Text fontSize={12.5} fontFamily={BIZLINK_FONTS.semibold} color={BIZLINK_COLORS.text}>{client.name}</Text>
          <Text fontSize={13} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted} marginTop={4}>
            Kasalukuyang agent: <Text color={BIZLINK_COLORS.text} fontFamily={BIZLINK_FONTS.semibold}>{currentAgent?.name ?? 'Unassigned'}</Text>
          </Text>
        </YStack>

        {isHeldGuestClient ? (
          <YStack backgroundColor={BIZLINK_COLORS.tintA} borderRadius={20} padding={14} marginBottom="$3.5">
            <Text fontSize={12.5} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.brand}>
              This is a held record from another team. Reassigning it moves it onto your own team — pick one of your own agents below.
            </Text>
          </YStack>
        ) : null}

        {!online ? (
          <YStack backgroundColor={BIZLINK_COLORS.amberSoft} borderRadius={20} padding={14} marginBottom="$3.5">
            <Text fontSize={12.5} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.orange}>
              Reassigning a client needs an internet connection. There's no offline queue for this.
            </Text>
          </YStack>
        ) : null}

        <Text fontFamily={BIZLINK_FONTS.semibold} fontSize={16} color={BIZLINK_COLORS.text} marginBottom="$2.5">Pick the new agent</Text>

        {candidatesLoading ? (
          <YStack alignItems="center" paddingVertical="$5">
            <Spinner size="large" color={BIZLINK_COLORS.brand} />
          </YStack>
        ) : candidatesError ? (
          <YStack alignItems="center" paddingVertical="$5" gap="$3">
            <Text fontSize={13} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted} textAlign="center">{candidatesError}</Text>
            <BizButton small label="Ulitin" variant="white" onPress={loadCandidates} />
          </YStack>
        ) : candidates.length === 0 ? (
          <Text fontSize={13} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted} textAlign="center" paddingVertical="$4">
            There are no other agents on your team.
          </Text>
        ) : (
          candidates.map((a) => {
            const color = avatarPaletteFor(a.id);
            const selected = selectedAgentId === a.id;
            return (
              <XStack
                key={a.id}
                alignItems="center"
                gap="$3"
                backgroundColor={selected ? BIZLINK_COLORS.tintA : BIZLINK_COLORS.card}
                borderRadius={20}
                padding={14}
                minHeight={56}
                borderWidth={selected ? 2 : 0}
                borderColor={selected ? BIZLINK_COLORS.brand : 'transparent'}
                marginBottom={10}
                onPress={() => setSelectedAgentId(a.id)}
              >
                <Avatar initials={a.initials} background={color.background} color={color.color} />
                <YStack flex={1}>
                  <Text fontFamily={BIZLINK_FONTS.semibold} fontSize={14} color={BIZLINK_COLORS.text}>{a.fullName}</Text>
                  <Text fontSize={10.5} fontFamily={BIZLINK_FONTS.semibold} color={BIZLINK_COLORS.muted}>{a.activeClients} clients</Text>
                </YStack>
                <ChevronRight
                  size={20}
                  color={selected ? BIZLINK_COLORS.brand : BIZLINK_COLORS.muted}
                  strokeWidth={1.75}
                />
              </XStack>
            );
          })
        )}

        <YStack marginTop="$2" gap="$1.5">
          <Text fontSize={11} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted} letterSpacing={0.4}>Reason for reassignment</Text>
          <TextInput
            value={reason}
            onChangeText={setReason}
            placeholder="Why are you reassigning this client?"
            placeholderTextColor={BIZLINK_COLORS.muted}
            multiline
            textAlignVertical="top"
            style={{ minHeight: 96, borderRadius: 16, backgroundColor: BIZLINK_COLORS.card, borderWidth: 1, borderColor: BIZLINK_COLORS.line, padding: 14, fontFamily: BIZLINK_FONTS.medium, fontSize: 14, color: BIZLINK_COLORS.text }}
          />
          <Text fontSize={12} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted}>This is required for a permanent audit trail. Reassignment is online-only.</Text>
        </YStack>

        {submitError ? (
          <Text fontSize={12.5} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.red} marginTop="$2.5" textAlign="center">
            {submitError}
          </Text>
        ) : null}

        <YStack marginTop="$4">
          <BizButton
            label={submitting ? 'Nire-reassign…' : 'Confirm Reassignment'}
            disabled={!selectedAgentId || !reason.trim() || !online || submitting}
            onPress={confirm}
          />
        </YStack>
      </KeyboardAwareScrollView>
    </YStack>
  );
}
