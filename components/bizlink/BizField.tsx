import { useState } from 'react';
import { Pressable, TextInput, type KeyboardTypeOptions } from 'react-native';
import { Eye, EyeOff } from 'lucide-react-native';
import { Text, View, YStack } from 'tamagui';
import { BIZLINK_COLORS, BIZLINK_FONTS } from '../../lib/theme';

interface BizFieldProps {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  hint?: React.ReactNode;
  secureTextEntry?: boolean;
  showToggle?: boolean;
  keyboardType?: KeyboardTypeOptions;
  multiline?: boolean;
}

/**
 * T-014 Phase 2 (ADR-024): BizLink `.field`/`.inp` — canvas-tinted input,
 * 16px radius, micro-label above. Replaces `Field` within `app/(tabs)` for
 * this phase.
 */
export function BizField({
  label,
  value,
  onChangeText,
  placeholder,
  hint,
  secureTextEntry,
  showToggle = false,
  keyboardType,
  multiline = false,
}: BizFieldProps) {
  const [revealed, setRevealed] = useState(false);
  const isSecure = secureTextEntry && !revealed;

  return (
    <YStack marginBottom="$3.5" gap="$1.5">
      <Text fontSize={11} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted} letterSpacing={0.4}>
        {label}
      </Text>
      <View position="relative">
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={BIZLINK_COLORS.muted}
          secureTextEntry={isSecure}
          keyboardType={keyboardType}
          multiline={multiline}
          style={{
            height: multiline ? 74 : 52,
            borderRadius: 16,
            paddingHorizontal: 16,
            paddingRight: showToggle ? 44 : 16,
            paddingVertical: multiline ? 14 : 0,
            fontFamily: BIZLINK_FONTS.medium,
            fontSize: 14.5,
            color: BIZLINK_COLORS.text,
            backgroundColor: BIZLINK_COLORS.canvas,
            textAlignVertical: multiline ? 'top' : 'center',
          }}
        />
        {secureTextEntry && showToggle ? (
          <Pressable
            onPress={() => setRevealed((prev) => !prev)}
            style={{ position: 'absolute', right: 14, top: 0, height: 52, justifyContent: 'center' }}
            hitSlop={8}
          >
            {revealed ? (
              <EyeOff size={18} color={BIZLINK_COLORS.muted} strokeWidth={1.75} />
            ) : (
              <Eye size={18} color={BIZLINK_COLORS.muted} strokeWidth={1.75} />
            )}
          </Pressable>
        ) : null}
      </View>
      {hint}
    </YStack>
  );
}
