import { Button, Label, Text, XStack, YStack } from 'tamagui';
import type { MeetingMode } from '../../types';

interface MeetingModeToggleProps {
  mode: MeetingMode;
  onChange: (mode: MeetingMode) => void;
}

/**
 * In-person / online meeting selector (ADR-012). For online meetings the GPS
 * captured with the photo is the agent's own location, and the record carries
 * this flag so maps/reports never plot it as a client-site visit.
 */
export function MeetingModeToggle({ mode, onChange }: MeetingModeToggleProps) {
  return (
    <YStack gap="$2">
      <Label>Meeting mode</Label>
      <XStack gap="$2">
        <Button
          flex={1}
          size="$3"
          theme={mode === 'in_person' ? 'active' : undefined}
          onPress={() => onChange('in_person')}
        >
          In-person
        </Button>
        <Button
          flex={1}
          size="$3"
          theme={mode === 'online' ? 'active' : undefined}
          onPress={() => onChange('online')}
        >
          Online
        </Button>
      </XStack>
      {mode === 'online' ? (
        <Text fontSize="$2" color="$colorPress">
          Online meeting — GPS will record your own location, not the client&apos;s.
        </Text>
      ) : null}
    </YStack>
  );
}
