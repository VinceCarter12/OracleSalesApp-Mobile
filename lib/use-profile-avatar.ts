import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { getStoredAvatarUri } from './profile-avatar';

// F-014 Phase 2 (ADR-029): extracted out of the three Account screens
// (`app/(tabs)/more/account.tsx`, `app/(manager)/more/account.tsx`,
// `app/(executive)/more/account.tsx`), which previously each duplicated this
// exact state/focus-load block. Visual layout stays in each screen — this
// hook only owns the avatar read state.
//
// 2026-08-09 (Vince): self-service editing removed — profile info, including
// the avatar, is admin/web-managed only now. This hook is read-only; it no
// longer exposes a pick handler.

export interface UseProfileAvatarResult {
  avatarUri: string | null;
}

/**
 * @param authUid `session.user.id` (Supabase Auth uid) — the identifier
 * ADR-029 uses for avatar storage/sync, NOT `profileId`. Screens get this
 * from `useAuth().session?.user.id`. No-op (returns null) until defined.
 */
export function useProfileAvatar(authUid: string | undefined): UseProfileAvatarResult {
  const [avatarUri, setAvatarUri] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      if (!authUid) return;
      getStoredAvatarUri(authUid).then(setAvatarUri);
    }, [authUid])
  );

  return { avatarUri };
}
