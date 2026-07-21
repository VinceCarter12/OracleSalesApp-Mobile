import * as SecureStore from 'expo-secure-store';
import * as ImagePicker from 'expo-image-picker';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import { Directory, File, Paths } from 'expo-file-system';
import { supabase } from './supabase';
import { checkConnectivity } from './sync/connectivity';
import { showToast } from './toast';
import { withTimeout } from './with-timeout';

/**
 * Profile picture storage — LOCAL-first (F-014 Phase 1, 2026-07-17), synced
 * to Supabase Storage + `profiles.avatar_url` since Phase 2 (ADR-029,
 * 2026-07-20). Uses a lightweight per-user SecureStore queue rather than the
 * full outbox/pending_uploads machinery — see ADR-029's rationale (a lost
 * avatar re-upload just costs the user one re-pick, unlike a lost meeting
 * record).
 *
 * Gallery-based (not camera) is intentional here — this is a profile
 * picture, not a meeting visit-proof photo, so the camera-only rule
 * (`.claude/rules/40-mobile-app.md` rule 6) does not apply (F-014's
 * gallery-picker exemption).
 *
 * Identity note (ADR-029): uploads key off `session.user.id` (Auth uid), NOT
 * `profiles.id` — the opposite convention from clients/meetings (ADR-023).
 * The `avatars` bucket's Storage RLS and the `profiles` UPDATE policy both
 * predicate on `auth.uid()`, so Auth uid is the correct identifier here.
 */

const AVATAR_TARGET_SIZE = 256;
const AVATAR_STORAGE_BUCKET = 'avatars';
const AVATAR_LOCAL_DIR_NAME = 'avatars';
const AVATAR_LOCAL_FILE_NAME = 'avatar.jpg';
const AVATAR_OFFLINE_TOAST = 'Na-save ang photo — ia-upload kapag online.';
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

async function setStoredAvatarUri(authUid: string, uri: string): Promise<void> {
  await SecureStore.setItemAsync(avatarUriKey(authUid), uri);
}

async function markAvatarUploadPending(authUid: string): Promise<void> {
  await SecureStore.setItemAsync(avatarPendingKey(authUid), '1');
}

async function clearAvatarUploadPending(authUid: string): Promise<void> {
  await SecureStore.deleteItemAsync(avatarPendingKey(authUid));
}

async function isAvatarUploadPending(authUid: string): Promise<boolean> {
  return (await SecureStore.getItemAsync(avatarPendingKey(authUid))) !== null;
}

/**
 * Resizes the picked image to a 256x256 JPEG (ADR-029), then copies the
 * manipulator's output — which lives in an evictable cache directory — into
 * `Paths.document` so it survives OS cache eviction between app launches.
 */
async function persistResizedAvatar(pickedUri: string): Promise<string> {
  const manipulated = await manipulateAsync(
    pickedUri,
    [{ resize: { width: AVATAR_TARGET_SIZE, height: AVATAR_TARGET_SIZE } }],
    { compress: 0.7, format: SaveFormat.JPEG }
  );

  const avatarsDir = new Directory(Paths.document, AVATAR_LOCAL_DIR_NAME);
  if (!avatarsDir.exists) {
    avatarsDir.create({ intermediates: true });
  }

  const destination = new File(avatarsDir, AVATAR_LOCAL_FILE_NAME);
  if (destination.exists) {
    destination.delete();
  }
  await new File(manipulated.uri).copy(destination);
  return destination.uri;
}

/**
 * Opens the device photo gallery, lets the user pick + crop a square image,
 * resizes/compresses it, and persists it locally (queued for background
 * upload — see `uploadPendingAvatar`). Returns null if the user cancels or
 * denies permission (permission denial shows no error — caller may show its
 * own message if desired).
 */
export async function pickProfileAvatar(authUid: string): Promise<string | null> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (permission.status !== 'granted') {
    return null;
  }
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    quality: 0.7,
    allowsEditing: true,
    aspect: [1, 1],
  });
  if (result.canceled || result.assets.length === 0) return null;

  const finalUri = await persistResizedAvatar(result.assets[0].uri);
  await setStoredAvatarUri(authUid, finalUri);
  await markAvatarUploadPending(authUid);

  // Non-blocking: local pick+save must succeed regardless of connectivity —
  // the toast is best-effort feedback, never awaited by the caller's UI.
  checkConnectivity()
    .then((connectivity) => {
      if (connectivity !== 'online') showToast(AVATAR_OFFLINE_TOAST);
    })
    .catch(() => {});

  return finalUri;
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
