import { createClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import type { Database } from '../types/database';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

/**
 * Custom storage adapter using expo-secure-store so Supabase auth tokens
 * are persisted securely on the device (not in AsyncStorage/plain text).
 */
const ExpoSecureStoreAdapter = {
  getItem: (key: string) => SecureStore.getItemAsync(key),
  setItem: (key: string, value: string) => SecureStore.setItemAsync(key, value),
  removeItem: (key: string) => SecureStore.deleteItemAsync(key),
};

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    // SecureStore is native-only; on web, supabase-js falls back to localStorage.
    ...(Platform.OS !== 'web' && { storage: ExpoSecureStoreAdapter }),
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
