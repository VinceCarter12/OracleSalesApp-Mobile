import { Platform, ToastAndroid, Alert } from 'react-native';

/** Lightweight toast — wireframe .toast equivalent. Android-first (device target). */
export function showToast(message: string): void {
  if (Platform.OS === 'android') {
    ToastAndroid.show(message, ToastAndroid.SHORT);
  } else {
    Alert.alert('', message);
  }
}
