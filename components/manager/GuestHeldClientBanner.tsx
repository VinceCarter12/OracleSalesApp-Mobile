import { UserSquare } from 'lucide-react-native';
import { Text, XStack } from 'tamagui';
import { BIZLINK_COLORS, BIZLINK_FONTS } from '../../lib/theme';
import type { TeamClient } from '../../types';

/**
 * Guest Records scope (2026-08-22): distinct from `TagAlongGuestBanner`
 * (`app/(manager)/more/meetings/[id].tsx`) — that one is about "I personally
 * tagged along on this specific meeting"; this one is about the CLIENT
 * record itself being a permanent held record (ADR-067), independent of
 * whether the viewer ever attended any meeting on it. Different semantics,
 * so deliberately not a shared component. Extracted out of
 * `app/(manager)/more/clients/[id].tsx` to keep that route file under this
 * repo's 300-line cap.
 */
export function GuestHeldClientBanner({ client }: { client: TeamClient }) {
  if (!client.isGuestRecord) return null;
  return (
    <XStack alignItems="flex-start" gap="$2" backgroundColor={BIZLINK_COLORS.soft} borderRadius={20} padding={14} marginTop="$3">
      <UserSquare size={15} color={BIZLINK_COLORS.navy} strokeWidth={1.75} />
      <Text fontSize={12} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.navy} flex={1} lineHeight={17}>
        Held record — this client belongs to {client.guestOwnerAgentName ?? 'another team'}. You can see its full
        history and approve edit requests on it, but you don't own it.
      </Text>
    </XStack>
  );
}
