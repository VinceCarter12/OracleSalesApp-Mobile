import { Text, YStack } from 'tamagui';
import { BIZLINK_COLORS, BIZLINK_FONTS } from '../../lib/theme';
import { BizCard } from '../bizlink/BizCard';
import { BizButton } from '../bizlink/BizButton';
import type { MeetingDraft } from '../../lib/meeting-drafts';

interface DraftResumePromptProps {
  draft: MeetingDraft;
  onResume: () => void;
  onDiscard: () => void;
}

// 2026-08-02 (Step B controller consolidation): the fast path's original
// disclosure copy is preserved verbatim — only mode/GPS/time/companions
// restore, agenda still needs re-ticking. The full form's draft persistence
// is new (it previously had none at all); its resume is even more partial —
// outcome and remarks are collected post-Start in that flow and were never
// part of MeetingDraftPayload either — the exact field set each flow still
// needs re-entered is the single source of truth in
// `getFieldsRequiringReentryAfterResume()`
// (lib/policies/meeting-draft-resume-policy.ts); keep these two strings in
// sync with that function if either flow's post-Start fields ever change.
const RESUME_DETAIL_TL: Record<MeetingDraft['flow'], string> = {
  visit: 'mananatili ang GPS/oras ng simula, pero kailangan mo ulit i-tick ang agenda',
  full: 'mananatili ang GPS/oras ng simula at ang mga kasamang napili, pero kailangan mong ulitin ang agenda, outcome, at remarks',
};

/**
 * ADR-026 P1 item 3 (Meeting Draft Recovery) — small interstitial shown on
 * mount when a same-day, still-valid draft exists for this client. Two
 * options only, matching the existing BizLink component vocabulary; not a
 * new screen or a general draft-editing surface (out of scope per the ADR).
 */
export function DraftResumePrompt({ draft, onResume, onDiscard }: DraftResumePromptProps) {
  return (
    <BizCard flat borderRadius={20} marginTop="$4">
      <Text fontFamily={BIZLINK_FONTS.semibold} fontSize={14} color={BIZLINK_COLORS.ink}>
        May naka-simulang meeting na hindi pa natatapos
      </Text>
      <Text
        fontSize={12.5}
        fontFamily={BIZLINK_FONTS.medium}
        color={BIZLINK_COLORS.ink}
        marginTop="$1"
        marginBottom="$3"
        lineHeight={17}
      >
        Na-start ang meeting na ito noong {new Date(draft.payload.capturedAt).toLocaleTimeString()} — bago naabala
        ang app. Ipagpatuloy ({RESUME_DETAIL_TL[draft.flow]}) o simulan ulit?
      </Text>
      <YStack gap="$2">
        <BizButton label="Ipagpatuloy" onPress={onResume} />
        <BizButton label="Simulan ulit" variant="white" onPress={onDiscard} />
      </YStack>
    </BizCard>
  );
}
