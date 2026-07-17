import { useState } from 'react';
import { Modal, Pressable, ScrollView, TextInput } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AlertCircle, ArrowLeft, GitBranch } from 'lucide-react-native';
import { Text, View, XStack, YStack } from 'tamagui';
import { BIZLINK_COLORS, BIZLINK_FONTS } from '../../lib/theme';

// T-014 Phase 1 (ADR-022 §6 + ADR-024 Phase 1): the Conflict Notice screen was
// only ever built in the wireframes (Wireframe-Sales-BizLink.html's
// #a-syncconflict + aRenderSyncConflict()) — this is its first real-code
// implementation. Mirrors the wireframe's Compare / Rename / Use-server-
// version pattern exactly for the `conflict` variant, and a single Retry
// action for the `failed` (dead-lettered) variant.

export interface ConflictCompareField {
  label: string;
  localValue: string;
  serverValue: string;
}

export interface ConflictNoticeScreenProps {
  visible: boolean;
  /** `conflict` = duplicate detected at sync (ADR-018/ADR-022 §6); `failed` = dead-lettered after 10 retries (ADR-018 §9). */
  variant: 'conflict' | 'failed';
  /** e.g. the client's company name, or "Meeting — {client} ({date})" per the wireframe's label convention. */
  recordLabel: string;
  /** Local-vs-server field comparison rows — only meaningful for the `conflict` variant. */
  compareFields?: ConflictCompareField[];
  /**
   * TODO: not yet wired to a real mutation — `lib/sync-engine.ts` has no
   * rename/re-queue action today (only `retryFailedOutboxRow` for the
   * `failed` path exists). Wire this to the real conflict-resolution
   * mutation when it lands; this component only owns the UI/props shape.
   */
  onRename: (newCompanyName: string) => void;
  /**
   * TODO: not yet wired to a real mutation — same gap as onRename above.
   * Per ADR-018 §6, this should discard the local duplicate and adopt the
   * server record once the real mutation exists.
   */
  onUseServerVersion: () => void;
  /** Wired to the real `retryFailedOutboxRow()` (lib/sync-engine.ts) by the caller — this component just awaits it. */
  onRetry?: () => Promise<void>;
  onClose: () => void;
}

export function ConflictNoticeScreen({
  visible,
  variant,
  recordLabel,
  compareFields = [],
  onRename,
  onUseServerVersion,
  onRetry,
  onClose,
}: ConflictNoticeScreenProps) {
  const insets = useSafeAreaInsets();
  const [showCompare, setShowCompare] = useState(false);
  const [showRenameInput, setShowRenameInput] = useState(false);
  const [renameValue, setRenameValue] = useState('');
  const [retrying, setRetrying] = useState(false);
  const [retryError, setRetryError] = useState<string | null>(null);

  const isConflict = variant === 'conflict';
  const bannerText = isConflict
    ? 'May kaparehong company name na naitala na ng ibang agent. Piliin kung anong gagawin.'
    : 'Hindi na-upload ang record na ito pagkatapos ng 10 subok. Kailangan ng manual na pag-retry.';

  async function handleRetry(): Promise<void> {
    if (!onRetry) return;
    setRetrying(true);
    setRetryError(null);
    try {
      await onRetry();
      onClose();
    } catch (err) {
      setRetryError(err instanceof Error ? err.message : 'Hindi na-retry — subukan ulit.');
    } finally {
      setRetrying(false);
    }
  }

  function handleConfirmRename(): void {
    const trimmed = renameValue.trim();
    if (!trimmed) return;
    onRename(trimmed);
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <YStack flex={1} backgroundColor={BIZLINK_COLORS.canvas} paddingTop={insets.top} paddingBottom={insets.bottom}>
        <XStack alignItems="center" gap="$2.5" paddingHorizontal="$4" paddingVertical="$2.5">
          <Pressable
            onPress={onClose}
            hitSlop={8}
            style={{
              width: 44,
              height: 44,
              borderRadius: 22,
              backgroundColor: BIZLINK_COLORS.card,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <ArrowLeft size={18} color={BIZLINK_COLORS.text} strokeWidth={1.75} />
          </Pressable>
          <Text fontSize={18} fontFamily={BIZLINK_FONTS.semibold} color={BIZLINK_COLORS.text}>
            Sync Conflict
          </Text>
        </XStack>

        <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32 }}>
          <YStack backgroundColor={BIZLINK_COLORS.card} borderRadius={24} padding={18}>
            <XStack alignItems="center" gap="$2.5">
              {isConflict ? (
                <GitBranch size={20} color={BIZLINK_COLORS.red} strokeWidth={1.75} />
              ) : (
                <AlertCircle size={20} color={BIZLINK_COLORS.red} strokeWidth={1.75} />
              )}
              <Text fontSize={15.5} fontFamily={BIZLINK_FONTS.semibold} color={BIZLINK_COLORS.text} flex={1}>
                {recordLabel}
              </Text>
            </XStack>

            <View backgroundColor={BIZLINK_COLORS.tintB} borderRadius={16} padding={14} marginTop={12}>
              <Text fontSize={13.5} fontFamily={BIZLINK_FONTS.regular} color={BIZLINK_COLORS.text}>
                {bannerText}
              </Text>
            </View>

            {isConflict ? (
              <Pressable
                onPress={() => setShowCompare((prev) => !prev)}
                style={{
                  marginTop: 14,
                  height: 44,
                  borderRadius: 999,
                  backgroundColor: BIZLINK_COLORS.soft,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Text fontSize={13} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.text}>
                  {showCompare ? 'Itago ang comparison' : 'Compare'}
                </Text>
              </Pressable>
            ) : null}

            {isConflict && showCompare ? (
              <YStack marginTop={12} gap="$2">
                {compareFields.map((field) => (
                  <YStack key={field.label} borderTopWidth={1} borderTopColor={BIZLINK_COLORS.line} paddingTop={10}>
                    <Text fontSize={11} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted}>
                      {field.label}
                    </Text>
                    <XStack justifyContent="space-between" marginTop={2}>
                      <Text fontSize={13} fontFamily={BIZLINK_FONTS.regular} color={BIZLINK_COLORS.text}>
                        Ikaw: {field.localValue}
                      </Text>
                      <Text fontSize={13} fontFamily={BIZLINK_FONTS.regular} color={BIZLINK_COLORS.muted}>
                        Server: {field.serverValue}
                      </Text>
                    </XStack>
                  </YStack>
                ))}
              </YStack>
            ) : null}
          </YStack>

          {retryError ? (
            <Text fontSize={12} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.red} marginTop={10}>
              {retryError}
            </Text>
          ) : null}

          <XStack gap="$2.5" marginTop={16}>
            {isConflict ? (
              <>
                <Pressable
                  onPress={() => setShowRenameInput(true)}
                  style={{
                    flex: 1,
                    height: 52,
                    borderRadius: 999,
                    backgroundColor: BIZLINK_COLORS.card,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Text fontSize={15} fontFamily={BIZLINK_FONTS.semibold} color={BIZLINK_COLORS.text}>
                    Rename
                  </Text>
                </Pressable>
                <Pressable
                  onPress={onUseServerVersion}
                  style={{
                    flex: 1,
                    height: 52,
                    borderRadius: 999,
                    backgroundColor: BIZLINK_COLORS.brand,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Text fontSize={15} fontFamily={BIZLINK_FONTS.semibold} color={BIZLINK_COLORS.card}>
                    Gamitin ang server version
                  </Text>
                </Pressable>
              </>
            ) : (
              <Pressable
                onPress={handleRetry}
                disabled={retrying}
                style={{
                  flex: 1,
                  height: 52,
                  borderRadius: 999,
                  backgroundColor: BIZLINK_COLORS.brand,
                  alignItems: 'center',
                  justifyContent: 'center',
                  opacity: retrying ? 0.6 : 1,
                }}
              >
                <Text fontSize={15} fontFamily={BIZLINK_FONTS.semibold} color={BIZLINK_COLORS.card}>
                  {retrying ? 'Sinusubukan ulit…' : 'Subukan ulit'}
                </Text>
              </Pressable>
            )}
          </XStack>

          {isConflict && showRenameInput ? (
            <YStack backgroundColor={BIZLINK_COLORS.card} borderRadius={24} padding={18} marginTop={14}>
              <Text fontSize={11} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted} marginBottom={6}>
                Bagong company name
              </Text>
              <View
                borderWidth={1}
                borderColor={BIZLINK_COLORS.line}
                borderRadius={16}
                height={52}
                paddingHorizontal={14}
                justifyContent="center"
                backgroundColor={BIZLINK_COLORS.canvas}
              >
                <RenameTextInput value={renameValue} onChangeText={setRenameValue} placeholder={`${recordLabel} (2)`} />
              </View>
              <Pressable
                onPress={handleConfirmRename}
                style={{
                  marginTop: 10,
                  height: 52,
                  borderRadius: 999,
                  backgroundColor: BIZLINK_COLORS.brand,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Text fontSize={15} fontFamily={BIZLINK_FONTS.semibold} color={BIZLINK_COLORS.card}>
                  I-save ang bagong pangalan
                </Text>
              </Pressable>
            </YStack>
          ) : null}
        </ScrollView>
      </YStack>
    </Modal>
  );
}

// Kept as a tiny local wrapper (not TextInput directly inline above) so the
// controlled-input styling stays isolated from the surrounding layout JSX.
function RenameTextInput({
  value,
  onChangeText,
  placeholder,
}: {
  value: string;
  onChangeText: (text: string) => void;
  placeholder: string;
}) {
  return (
    <TextInput
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor={BIZLINK_COLORS.muted}
      style={{ fontSize: 14.5, fontFamily: BIZLINK_FONTS.medium, color: BIZLINK_COLORS.text }}
    />
  );
}
