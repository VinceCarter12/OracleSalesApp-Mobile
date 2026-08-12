import type { PropsWithChildren } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/**
 * App-wide keyboard boundary.
 *
 * Android uses the native `adjustResize` window mode (configured in app.json)
 * as the sole resize authority. iOS keeps the existing safe-area-aware padding
 * behavior for parity.
 */
export function KeyboardResponsiveView({ children }: PropsWithChildren) {
  const insets = useSafeAreaInsets();

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior="padding"
      keyboardVerticalOffset={Platform.OS === 'ios' ? insets.top : 0}
      enabled={Platform.OS === 'ios'}
    >
      {children}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
});
