import { TextInput, type KeyboardTypeOptions } from 'react-native';
import { Text, YStack } from 'tamagui';
import { COLORS } from '../../lib/theme';

interface FieldProps {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  hint?: React.ReactNode;
  secureTextEntry?: boolean;
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
  keyboardType,
  multiline = false,
}: FieldProps) {
  return (
    <YStack marginBottom="$3.5" gap="$1.5">
      <Text fontSize={12.5} fontWeight="800" color={COLORS.eel} textTransform="uppercase">
        {label}
      </Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={COLORS.hare}
        secureTextEntry={secureTextEntry}
        keyboardType={keyboardType}
        multiline={multiline}
        style={{
          height: multiline ? 70 : 50,
          borderWidth: 2,
          borderColor: COLORS.swan,
          borderRadius: 12,
          paddingHorizontal: 14,
          paddingVertical: multiline ? 12 : 0,
          fontWeight: '700',
          fontSize: 14.5,
          color: COLORS.eel,
          backgroundColor: COLORS.snow,
          textAlignVertical: multiline ? 'top' : 'center',
        }}
      />
      {hint}
    </YStack>
  );
}
