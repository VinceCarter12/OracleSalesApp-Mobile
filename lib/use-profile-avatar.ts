import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { getStoredAvatarUri, pickProfileAvatar } from './profile-avatar';
import { showToast } from './toast';

// F-014 Phase 2 (ADR-029): extracted out of the three Account screens
// (`app/(tabs)/more/account.tsx`, `app/(manager)/more/account.tsx`,
// `app/(executive)/more/account.tsx`), which previously each duplicated this
// exact state/focus-load/pick-handler block. Visual layout stays in each
// screen — this hook only owns the avatar state + pick flow.

export interface UseProfileAvatarResult {
  avatarUri: string | null;
  pickingAvatar: boolean;
  handlePickAvatar: () => Promise<void>;
}

/**
 * @param authUid `session.user.id` (Supabase Auth uid) — the identifier
 * ADR-029 uses for avatar storage/sync, NOT `profileId`. Screens get this
 * from `useAuth().session?.user.id`. No-ops (returns nulls) until defined.
 */
export function useProfileAvatar(authUid: string | undefined): UseProfileAvatarResult {
  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const [pickingAvatar, setPickingAvatar] = useState(false);

  useFocusEffect(
    useCallback(() => {
      if (!authUid) return;
      getStoredAvatarUri(authUid).then(setAvatarUri);
    }, [authUid])
  );

  async function handlePickAvatar(): Promise<void> {
    if (!authUid) return;
    setPickingAvatar(true);
    try {
      const uri = await pickProfileAvatar(authUid);
      if (uri) setAvatarUri(uri);
    } catch {
      showToast('Hindi ma-set ang profile picture. Subukan ulit.');
    } finally {
      setPickingAvatar(false);
    }
  }

  return { avatarUri, pickingAvatar, handlePickAvatar };
}
