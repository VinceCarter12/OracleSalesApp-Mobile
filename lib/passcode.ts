import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';

// B-064: real passcode storage for `components/security/SecurityGate.tsx`'s
// "Client info protection" gate (ADR-007). Same get/set-via-SecureStore shape
// as `lib/theme-preference.tsx` / `lib/wipe-local-data.ts`. Only the SHA-256
// hash is ever persisted — never the plaintext passcode.

const PASSCODE_HASH_KEY = 'oracle_sales_passcode_hash';

async function hashPasscode(code: string): Promise<string> {
  return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, code);
}

/** Hashes and persists a new 4-digit passcode, replacing any existing one. */
export async function setPasscode(code: string): Promise<void> {
  const hash = await hashPasscode(code);
  await SecureStore.setItemAsync(PASSCODE_HASH_KEY, hash);
}

/** Compares a candidate code's hash against the stored hash. False if none is set. */
export async function verifyPasscode(code: string): Promise<boolean> {
  const storedHash = await SecureStore.getItemAsync(PASSCODE_HASH_KEY);
  if (!storedHash) return false;
  const candidateHash = await hashPasscode(code);
  return candidateHash === storedHash;
}

/** Whether an agent has ever set a passcode on this device. */
export async function hasPasscodeSet(): Promise<boolean> {
  const storedHash = await SecureStore.getItemAsync(PASSCODE_HASH_KEY);
  return storedHash !== null;
}
