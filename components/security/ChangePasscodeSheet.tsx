import { useEffect, useState } from 'react';
import { Modal, Pressable } from 'react-native';
import { Text, XStack, YStack } from 'tamagui';
import { useBizlinkColors, BIZLINK_FONTS } from '../../lib/theme';
import { BizField } from '../bizlink/BizField';
import { BizButton } from '../bizlink/BizButton';
import { setPasscode, hasPasscodeSet, verifyPasscode } from '../../lib/passcode';
import { showToast } from '../../lib/toast';

const PASSCODE_LENGTH = 4;

interface ChangePasscodeSheetProps {
  visible: boolean;
  onClose: () => void;
}

function validate(code: string, confirmCode: string): string | null {
  if (code.length !== PASSCODE_LENGTH || !/^\d+$/.test(code)) {
    return `Passcode must be ${PASSCODE_LENGTH} digits.`;
  }
  if (code !== confirmCode) {
    return 'Passcodes do not match.';
  }
  return null;
}

/**
 * B-064: real "Change passcode" flow for `app/(tabs)/more/account.tsx`,
 * replacing the toast-only stub. Same bottom-sheet Modal shape as
 * `components/sync/SyncCenterSheet.tsx`; reuses `BizField`/`BizButton`
 * rather than inventing new input controls.
 *
 * Security fix: a change now requires re-entering the CURRENT passcode
 * (verified via `lib/passcode.ts::verifyPasscode()`) before a new one is
 * accepted — otherwise anyone holding an unlocked phone could silently
 * replace the passcode and permanently defeat `SecurityGate`. The current-
 * passcode field is skipped entirely on first-time setup, when
 * `hasPasscodeSet()` is false and there is nothing to verify against.
 */
export function ChangePasscodeSheet({ visible, onClose }: ChangePasscodeSheetProps) {
  const BIZLINK_COLORS = useBizlinkColors();
  const [hasExisting, setHasExisting] = useState(false);
  const [currentCode, setCurrentCode] = useState('');
  const [code, setCode] = useState('');
  const [confirmCode, setConfirmCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    hasPasscodeSet().then((isSet) => {
      if (!cancelled) setHasExisting(isSet);
    });
    return () => {
      cancelled = true;
    };
  }, [visible]);

  function reset(): void {
    setCurrentCode('');
    setCode('');
    setConfirmCode('');
    setError(null);
    setSaving(false);
  }

  function handleClose(): void {
    reset();
    onClose();
  }

  async function handleSave(): Promise<void> {
    const validationError = validate(code, confirmCode);
    if (validationError) {
      setError(validationError);
      return;
    }
    if (hasExisting && (currentCode.length !== PASSCODE_LENGTH || !/^\d+$/.test(currentCode))) {
      setError(`Current passcode must be ${PASSCODE_LENGTH} digits.`);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      if (hasExisting) {
        const isCurrentValid = await verifyPasscode(currentCode);
        if (!isCurrentValid) {
          setError('Maling kasalukuyang passcode.');
          setSaving(false);
          return;
        }
      }
      await setPasscode(code);
      showToast('Passcode updated');
      handleClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save passcode.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <Pressable
        onPress={handleClose}
        style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' }}
      >
        <Pressable onPress={(e) => e.stopPropagation()}>
          <YStack
            backgroundColor={BIZLINK_COLORS.canvas}
            borderTopLeftRadius={28}
            borderTopRightRadius={28}
            padding={18}
            paddingBottom={28}
          >
            <XStack justifyContent="center" marginBottom={12}>
              <YStack width={40} height={4} borderRadius={2} backgroundColor={BIZLINK_COLORS.line} />
            </XStack>

            <Text fontSize={18} fontFamily={BIZLINK_FONTS.semibold} color={BIZLINK_COLORS.text} marginBottom={16}>
              Change passcode
            </Text>

            {hasExisting ? (
              <BizField
                label="Current passcode"
                value={currentCode}
                onChangeText={(text) => setCurrentCode(text.replace(/\D/g, '').slice(0, PASSCODE_LENGTH))}
                placeholder="4-digit passcode"
                keyboardType="number-pad"
                secureTextEntry
                showToggle
              />
            ) : null}
            <BizField
              label="New passcode"
              value={code}
              onChangeText={(text) => setCode(text.replace(/\D/g, '').slice(0, PASSCODE_LENGTH))}
              placeholder="4-digit passcode"
              keyboardType="number-pad"
              secureTextEntry
              showToggle
            />
            <BizField
              label="Confirm passcode"
              value={confirmCode}
              onChangeText={(text) => setConfirmCode(text.replace(/\D/g, '').slice(0, PASSCODE_LENGTH))}
              placeholder="Re-enter passcode"
              keyboardType="number-pad"
              secureTextEntry
              showToggle
            />

            {error ? (
              <Text fontSize={12.5} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.red} marginBottom={12}>
                {error}
              </Text>
            ) : null}

            <BizButton label={saving ? 'Saving…' : 'Save passcode'} onPress={handleSave} disabled={saving} />
          </YStack>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
