import { useState } from 'react';
import { Pressable, TextInput, type KeyboardTypeOptions } from 'react-native';
import { Eye, EyeOff } from 'lucide-react-native';
import { Text, View, YStack } from 'tamagui';
import { COLORS } from '../../lib/theme';

interface FieldProps {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  hint?: React.ReactNode;
  secureTextEntry?: boolean;
  /** Adds an eye icon to reveal/hide a secureTextEntry field's value. */
  showToggle?: boolean;
  keyboardType?: KeyboardTypeOptions;
  multiline?: boolean;
}

/** Wireframe .field + .inp — 2px swan border, 12 radius, 700-weight input text. */
export function Field({
  label,
  value,
  onChangeText,
  placeholder,
  hint,
  secureTextEntry,
  showToggle = false,
  keyboardType,
  multiline = false,
}: FieldProps) {
  const [revealed, setRevealed] = useState(false);
  const isSecure = secureTextEntry && !revealed;

  return (
    <YStack marginBottom="$3.5" gap="$1.5">
      <Text fontSize={12.5} fontWeight="800" color={COLORS.eel} textTransform="uppercase">
        {label}
      </Text>
      <View position="relative">
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={COLORS.hare}
          secureTextEntry={isSecure}
          keyboardType={keyboardType}
          multiline={multiline}
          style={{
            height: multiline ? 70 : 50,
            borderWidth: 2,
            borderColor: COLORS.swan,
            borderRadius: 12,
            paddingHorizontal: 14,
            paddingRight: showToggle ? 44 : 14,
            paddingVertical: multiline ? 12 : 0,
            fontWeight: '700',
            fontSize: 14.5,
            color: COLORS.eel,
            backgroundColor: COLORS.snow,
            textAlignVertical: multiline ? 'top' : 'center',
          }}
        />
        {secureTextEntry && showToggle ? (
          <Pressable
            onPress={() => setRevealed((prev) => !prev)}
            style={{ position: 'absolute', right: 14, top: 0, height: 50, justifyContent: 'center' }}
            hitSlop={8}
          >
            {revealed ? (
              <EyeOff size={18} color={COLORS.hare} />
            ) : (
              <Eye size={18} color={COLORS.hare} />
            )}
          </Pressable>
        ) : null}
      </View>
      {hint}
    </YStack>
  );
}
