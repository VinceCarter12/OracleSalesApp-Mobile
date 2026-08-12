import { Text, YStack } from 'tamagui';
import { useBizlinkColors, BIZLINK_FONTS } from '../../lib/theme';
import { BizCard } from '../bizlink/BizCard';
import { BizButton } from '../bizlink/BizButton';
import type { MeetingDraft } from '../../lib/meeting-drafts';

interface DraftResumePromptProps {
  draft: MeetingDraft;
  onResume: () => void;
  onDiscard: () => void;
}

// 2026-08-04 (Vince direction): agenda ticks now persist too
// (MeetingDraftPayload.agendas) — the fast path's resume is a FULL restore
// (nothing left to re-enter). The full form's resume is still PARTIAL:
// outcome and remarks are collected post-Start in that flow and were never
// part of MeetingDraftPayload — the exact field set each flow still needs
// re-entered is the single source of truth in
// `getFieldsRequiringReentryAfterResume()`
// (lib/policies/meeting-draft-resume-policy.ts); keep these two strings in
// sync with that function if either flow's post-Start fields ever change.
const RESUME_DETAIL_TL: Record<MeetingDraft['flow'], string> = {
  visit: 'the start location and time stay, and the agenda items you ticked stay',
  full: "the start location and time, the companions you picked, and the agenda items you ticked all stay, but you'll need to do the outcome and remarks again",
};

/**
 * ADR-026 P1 item 3 (Meeting Draft Recovery) — small interstitial shown on
 * mount when a same-day, still-valid draft exists for this client. Two
 * options only, matching the existing BizLink component vocabulary; not a
 * new screen or a general draft-editing surface (out of scope per the ADR).
 */
export function DraftResumePrompt({ draft, onResume, onDiscard }: DraftResumePromptProps) {
  const BIZLINK_COLORS = useBizlinkColors();
  return (
    <BizCard flat borderRadius={20} marginTop="$4">
      <Text fontFamily={BIZLINK_FONTS.semibold} fontSize={14} color={BIZLINK_COLORS.ink}>
        A meeting you started hasn't been finished
      </Text>
      <Text
        fontSize={12.5}
        fontFamily={BIZLINK_FONTS.medium}
        color={BIZLINK_COLORS.ink}
        marginTop="$1"
        marginBottom="$3"
        lineHeight={17}
      >
        This meeting started at {new Date(draft.payload.capturedAt).toLocaleTimeString()} — before the app
        was interrupted. Continue ({RESUME_DETAIL_TL[draft.flow]}) or start again?
      </Text>
      <YStack gap="$2">
        <BizButton label="Continue" onPress={onResume} />
        <BizButton label="Start again" variant="white" onPress={onDiscard} />
      </YStack>
    </BizCard>
  );
}
