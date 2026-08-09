import * as SecureStore from 'expo-secure-store';
import { File } from 'expo-file-system';
import { supabase } from './supabase';
import { withTimeout } from './with-timeout';

/**
 * Profile picture storage — LOCAL-first (F-014 Phase 1, 2026-07-17), synced
 * to Supabase Storage + `profiles.avatar_url` since Phase 2 (ADR-029,
 * 2026-07-20).
 *
 * Self-service picking was removed 2026-08-09 (Vince): profile info,
 * including the avatar, is now admin/web-managed only — mobile is read-only.
 * This file keeps the read path (`getStoredAvatarUri`, consumed by the
 * Account screens and `lib/use-user-map-marker.ts`) and the upload-drain
 * path (`uploadPendingAvatar`, called from `sync-engine.ts`) so any avatar a
 * user picked before this change still finishes syncing on next launch; no
 * code path can set a new pending avatar anymore.
 *
 * Identity note (ADR-029): uploads key off `session.user.id` (Auth uid), NOT
 * `profiles.id` — the opposite convention from clients/meetings (ADR-023).
 * The `avatars` bucket's Storage RLS and the `profiles` UPDATE policy both
 * predicate on `auth.uid()`, so Auth uid is the correct identifier here.
 */

const AVATAR_STORAGE_BUCKET = 'avatars';
const AVATAR_LOCAL_FILE_NAME = 'avatar.jpg';
// Mirrors PHOTO_UPLOAD_TIMEOUT_MS (lib/meeting-photo-service.ts) — a stalled
// connection doesn't reject the Storage upload on its own, it hangs
// indefinitely, which would stall the entire runSync() pass since this is
// awaited inline before processOutbox()/syncDown() run.
const AVATAR_UPLOAD_TIMEOUT_MS = 30000;

// SecureStore keys only allow alphanumerics plus ".", "-", "_" — a plain
// ":" separator (used until this fix) throws "Invalid key provided to
// SecureStore" on Android, since Auth uids are UUIDs containing hyphens
// that read fine but the colon itself is rejected outright.
function avatarUriKey(authUid: string): string {
  return `profile_avatar_uri.${authUid}`;
}

function avatarPendingKey(authUid: string): string {
  return `profile_avatar_pending.${authUid}`;
}

export async function getStoredAvatarUri(authUid: string): Promise<string | null> {
  return SecureStore.getItemAsync(avatarUriKey(authUid));
}

async function clearAvatarUploadPending(authUid: string): Promise<void> {
  await SecureStore.deleteItemAsync(avatarPendingKey(authUid));
}

async function isAvatarUploadPending(authUid: string): Promise<boolean> {
  return (await SecureStore.getItemAsync(avatarPendingKey(authUid))) !== null;
}

/**
 * Uploads the locally-pending avatar (if any) to Supabase Storage and
 * patches `profiles.avatar_url`. No-ops instantly if nothing is pending.
 * Never throws — called from `sync-engine.ts::runSync()`'s drain pass, which
 * must never fail because of this feature. Errors are logged with enough
 * detail to distinguish which of the three steps failed (Storage upload vs.
 * profiles update vs. 0-rows-matched), and the pending flag is left set so
 * the next sync pass retries — except when the local file itself is gone,
 * which clears the flag since there is nothing left to retry.
 */
export async function uploadPendingAvatar(authUid: string): Promise<void> {
  try {
    if (!(await isAvatarUploadPending(authUid))) return;

    const localUri = await getStoredAvatarUri(authUid);
    if (!localUri || !new File(localUri).exists) {
      // Evicted despite the documentDirectory copy, or the user cleared app
      // data — nothing left to retry.
      await clearAvatarUploadPending(authUid);
      return;
    }

    const storagePath = `${authUid}/${AVATAR_LOCAL_FILE_NAME}`;
    const bytes = await new File(localUri).bytes();
    const { error: uploadError } = await withTimeout(
      supabase.storage.from(AVATAR_STORAGE_BUCKET).upload(storagePath, bytes, { contentType: 'image/jpeg', upsert: true }),
      AVATAR_UPLOAD_TIMEOUT_MS,
      `avatar upload (${storagePath})`
    );
    if (uploadError) {
      console.error('[profile-avatar] Storage upload failed:', uploadError.message);
      return;
    }

    const { data: publicUrlData } = supabase.storage.from(AVATAR_STORAGE_BUCKET).getPublicUrl(storagePath);
    const versionedUrl = `${publicUrlData.publicUrl}?v=${Date.now()}`;

    const { data: updatedRows, error: updateError } = await supabase
      .from('profiles')
      .update({ avatar_url: versionedUrl })
      .eq('user_id', authUid)
      .select('id');
    if (updateError) {
      console.error('[profile-avatar] profiles.avatar_url update failed:', updateError.message);
      return;
    }
    if (!updatedRows || updatedRows.length === 0) {
      console.error('[profile-avatar] profiles.avatar_url update matched 0 rows for user_id', authUid);
      return;
    }

    await clearAvatarUploadPending(authUid);
  } catch (err) {
    console.error(
      '[profile-avatar] uploadPendingAvatar unexpected error:',
      err instanceof Error ? err.message : String(err)
    );
  }
}
