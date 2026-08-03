import { FileCheck2, Paperclip, Check } from 'lucide-react-native';
import { Text, YStack } from 'tamagui';
import { useBizlinkColors, BIZLINK_FONTS } from '../../lib/theme';
import { BizButton } from '../bizlink/BizButton';

interface PoEvidenceCardProps {
  /** Only rendered when the In Progress agenda includes 'Close deal' (Wireframe-Sales-BizLink.html `#a-poEvidence`, `aTogglePoEvidence`). */
  visible: boolean;
  photoUri: string | null;
  capturing: boolean;
  onCapture: () => void;
}

/**
 * Wireframe `#a-poEvidence` card, 1:1: title, helper copy, and a single
 * capture button that locks into a "ready to submit" state once a photo is
 * attached (`aConfirmPoEvidence()`). Camera-only (hard project constraint) —
 * the actual `launchCameraAsync` call lives in the caller (record.tsx),
 * matching how `captureSelfie` is already owned by that screen rather than
 * this presentational card.
 */
export function PoEvidenceCard({ visible, photoUri, capturing, onCapture }: PoEvidenceCardProps) {
  const BIZLINK_COLORS = useBizlinkColors();
  if (!visible) return null;

  return (
    <YStack backgroundColor={BIZLINK_COLORS.card} borderRadius={20} padding={16} marginTop="$2.5" gap="$1.5">
      <YStack flexDirection="row" alignItems="center" gap="$2">
        {photoUri ? (
          <Check size={16} color={BIZLINK_COLORS.brand} strokeWidth={1.75} />
        ) : (
          <FileCheck2 size={16} color={BIZLINK_COLORS.text} strokeWidth={1.75} />
        )}
        <Text fontSize={13} fontFamily={BIZLINK_FONTS.semibold} color={BIZLINK_COLORS.text}>
          {photoUri ? 'PO evidence ready to submit' : 'PO evidence required'}
        </Text>
      </YStack>
      {!photoUri ? (
        <Text fontSize={12} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted} lineHeight={17}>
          Kumuha ng PO photo. Kapag online, ipapadala ito sa Manager approval; mananatiling In Progress habang
          pending.
        </Text>
      ) : null}
      <BizButton
        label={photoUri ? 'PO evidence attached' : capturing ? 'Opening camera…' : 'Attach PO evidence'}
        variant="white"
        small
        disabled={!!photoUri || capturing}
        icon={<Paperclip size={14} color={BIZLINK_COLORS.text} strokeWidth={1.75} />}
        onPress={onCapture}
        style={{ marginTop: 4 }}
      />
    </YStack>
  );
}
