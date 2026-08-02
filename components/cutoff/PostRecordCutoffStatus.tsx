import { Clock, TriangleAlert } from 'lucide-react-native';
import { Text, XStack } from 'tamagui';
import { useBizlinkColors, BIZLINK_FONTS } from '../../lib/theme';
import { useCutoffQuotaFlag } from '../../lib/use-cutoff-quota-flag';

interface PostRecordCutoffStatusProps {
  /** True when the client's cached allowance was already at/over cap at the moment this meeting was recorded (provisional, local-only signal — server reclassifies on sync). */
  wasAtCap: boolean;
}

/**
 * W-3 (Wireframe-Sales-BizLink.html `#a-celebrateCutoffStatus`): inline
 * provisional status shown right after a meeting is recorded. Renders
 * nothing when `cutoff_quota_v1` is OFF.
 */
export function PostRecordCutoffStatus({ wasAtCap }: PostRecordCutoffStatusProps) {
  const BIZLINK_COLORS = useBizlinkColors();
  const flagOn = useCutoffQuotaFlag();
  if (!flagOn) return null;

  return (
    <XStack
      alignItems="center"
      gap="$2"
      backgroundColor={wasAtCap ? '#FFF1D7' : BIZLINK_COLORS.tintA}
      borderRadius={16}
      padding={12}
      marginTop={12}
    >
      {wasAtCap ? (
        <TriangleAlert size={16} color="#7A4A00" strokeWidth={1.75} />
      ) : (
        <Clock size={16} color={BIZLINK_COLORS.ink} strokeWidth={1.75} />
      )}
      <Text fontSize={12} fontFamily={BIZLINK_FONTS.medium} color={wasAtCap ? '#7A4A00' : BIZLINK_COLORS.ink} flex={1}>
        {wasAtCap
          ? 'Recorded locally — may be over cap; awaiting server confirmation'
          : 'Recorded locally — awaiting server confirmation'}
      </Text>
    </XStack>
  );
}
