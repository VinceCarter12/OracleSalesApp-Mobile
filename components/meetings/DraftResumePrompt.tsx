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
        ang app. Ipagpatuloy (mananatili ang GPS/oras ng simula, pero kailangan mo ulit i-tick ang agenda) o simulan
        ulit?
      </Text>
      <YStack gap="$2">
        <BizButton label="Ipagpatuloy" onPress={onResume} />
        <BizButton label="Simulan ulit" variant="white" onPress={onDiscard} />
      </YStack>
    </BizCard>
  );
}
