import { Modal, Pressable } from 'react-native';
import { Text, YStack } from 'tamagui';
import { useBizlinkColors, BIZLINK_FONTS } from '../../lib/theme';
import { BizButton } from './BizButton';
import type { SignOutDialogVariant, SignOutSyncWarningDialogProps } from '../../lib/use-sign-out-with-sync-warning';

interface DialogContent {
  title: string;
  titleColor: 'text' | 'red';
  body: string;
}

function contentFor(variant: SignOutDialogVariant): DialogContent {
  switch (variant.kind) {
    case 'check-failed':
      return { title: 'Sign Out', titleColor: 'text', body: 'Could not check local sync status. Are you sure you want to sign out?' };
    case 'confirm':
      return { title: 'Sign Out', titleColor: 'text', body: 'Are you sure you want to sign out?' };
    case 'unsynced':
      return {
        title: 'Unsynced records',
        titleColor: 'red',
        body: `You still have ${variant.description}. Sign out will not erase them, but they cannot upload until this account signs in again on this device.`,
      };
    case 'sync-unavailable':
      return { title: 'Sync unavailable', titleColor: 'red', body: 'Your account details are missing. Stay signed in and try again.' };
    case 'sync-complete':
      return { title: 'Sync complete', titleColor: 'text', body: 'All records are uploaded. You can safely sign out now.' };
    case 'sync-incomplete':
      return {
        title: 'Sync not complete',
        titleColor: 'red',
        body: `${variant.description}. Stay signed in and try Sync Now again; these records will remain on this device.`,
      };
    case 'sign-out-failed':
      return { title: 'Could not sign out', titleColor: 'red', body: variant.message };
  }
}

/**
 * Themed replacement for the old `Alert.alert`-based sign-out sync warning
 * (lib/sign-out-with-sync-warning.ts, removed). Follows
 * `components/meetings/SameClientPoBlockedDialog.tsx`'s card pattern: dimmed
 * backdrop + rounded `colors.card` panel + stacked `BizButton`s, one variant
 * per `SignOutDialogVariant`. State/branching logic lives entirely in
 * `lib/use-sign-out-with-sync-warning.ts` — this component only renders.
 */
export function SignOutSyncWarningDialog({ visible, variant, syncing, onDismiss, onSyncNow, onSignOut }: SignOutSyncWarningDialogProps) {
  const colors = useBizlinkColors();
  if (!variant) return null;
  const content = contentFor(variant);
  const titleColor = content.titleColor === 'red' ? colors.red : colors.text;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onDismiss}>
      <Pressable
        onPress={onDismiss}
        style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center', padding: 24 }}
      >
        <Pressable onPress={(event) => event.stopPropagation()} accessible={false}>
          <YStack
            accessible
            accessibilityRole="alert"
            accessibilityViewIsModal
            backgroundColor={colors.card}
            borderRadius={24}
            padding="$4.5"
            width={320}
          >
            <Text fontSize={18} fontFamily={BIZLINK_FONTS.semibold} color={titleColor}>
              {content.title}
            </Text>
            <Text fontSize={13} fontFamily={BIZLINK_FONTS.medium} color={colors.muted} marginTop="$2" lineHeight={19}>
              {content.body}
            </Text>
            <YStack gap="$2" marginTop="$4">
              {variant.kind === 'unsynced' ? (
                <>
                  <BizButton label={syncing ? 'Syncing…' : 'Sync now'} onPress={onSyncNow} disabled={syncing} />
                  <BizButton label="Sign out anyway" variant="red" onPress={onSignOut} disabled={syncing} />
                  <BizButton label="Stay signed in" variant="white" onPress={onDismiss} disabled={syncing} />
                </>
              ) : null}
              {variant.kind === 'check-failed' ? (
                <>
                  <BizButton label="Sign Out" variant="red" onPress={onSignOut} />
                  <BizButton label="Stay signed in" variant="white" onPress={onDismiss} />
                </>
              ) : null}
              {variant.kind === 'confirm' ? (
                <>
                  <BizButton label="Sign Out" variant="red" onPress={onSignOut} />
                  <BizButton label="Cancel" variant="white" onPress={onDismiss} />
                </>
              ) : null}
              {variant.kind === 'sync-complete' ? (
                <>
                  <BizButton label="Sign Out" variant="red" onPress={onSignOut} />
                  <BizButton label="Stay signed in" variant="white" onPress={onDismiss} />
                </>
              ) : null}
              {variant.kind === 'sync-incomplete' || variant.kind === 'sync-unavailable' || variant.kind === 'sign-out-failed' ? (
                <BizButton label="OK" variant="white" onPress={onDismiss} />
              ) : null}
            </YStack>
          </YStack>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
