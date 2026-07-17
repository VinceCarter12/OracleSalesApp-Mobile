import * as SecureStore from 'expo-secure-store';
import * as ImagePicker from 'expo-image-picker';

const AVATAR_URI_KEY = 'profile_avatar_uri';

/**
 * LOCAL-ONLY profile picture storage (2026-07-17 feedback pass, A2).
 *
 * There is no `avatar_url` column on `profiles` (Supabase) or any local
 * SQLite table — adding one is a real schema change and out of scope for
 * this pass (would need `npm run web:status` + a schema/architecture pass
 * per `.claude/rules/40-mobile-app.md` rule 4). Until that follow-up lands,
 * the picked image's local file URI is persisted device-side only (via
 * expo-secure-store, same storage mechanism `lib/supabase.ts` uses for auth
 * tokens) — it does NOT sync to Supabase and is NOT visible on other
 * devices or to other users.
 *
 * Gallery-based (not camera) is intentional here — this is a profile
 * picture, not a meeting visit-proof photo, so the camera-only rule
 * (`.claude/rules/40-mobile-app.md` rule 6) does not apply.
 */

export async function getStoredAvatarUri(): Promise<string | null> {
  return SecureStore.getItemAsync(AVATAR_URI_KEY);
}

async function setStoredAvatarUri(uri: string): Promise<void> {
  await SecureStore.setItemAsync(AVATAR_URI_KEY, uri);
}

/**
 * Opens the device photo gallery, lets the user pick + crop a square image,
 * and persists the local URI. Returns null if the user cancels or denies
 * permission (permission denial shows no error — caller may show its own
 * message if desired).
 */
export async function pickProfileAvatar(): Promise<string | null> {
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
  const uri = result.assets[0].uri;
  await setStoredAvatarUri(uri);
  return uri;
}
