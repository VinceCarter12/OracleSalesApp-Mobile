import { useState } from 'react';
import { Alert, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { ClipboardList } from 'lucide-react-native';
import { Text, XStack, YStack } from 'tamagui';
import { BIZLINK_COLORS, BIZLINK_FONTS } from '../../../../lib/theme';
import { showToast } from '../../../../lib/toast';
import { DuplicateTeamClientNameError, useManagerStore } from '../../../../lib/manager-store';
import { BizTopBar } from '../../../../components/bizlink/BizTopBar';
import { BizField } from '../../../../components/bizlink/BizField';
import { BizCard } from '../../../../components/bizlink/BizCard';
import { BizSectionHeader } from '../../../../components/bizlink/BizSectionHeader';
import { BizChip } from '../../../../components/bizlink/BizChip';
import { BizButton } from '../../../../components/bizlink/BizButton';
import { SALES_CHANNELS, type SalesChannel } from '../../../../types';

/**
 * Manager Create Client — a manager can create clients same as an agent, but
 * it applies directly to the team roster with no approval step, since the
 * Sales Manager is the one who'd approve it anyway (ADR-020). Mirrors
 * app/(tabs)/clients/create.tsx's UX; writes go through manager-store.tsx's
 * mock in-memory dataset (F-013 has no Supabase manager tables yet — same
 * limitation as the rest of the Manager frontend).
 */
export default function ManagerCreateClientScreen() {
  const insets = useSafeAreaInsets();
  const { addClient } = useManagerStore();
  const [companyName, setCompanyName] = useState('');
  const [channel, setChannel] = useState<SalesChannel>('Distributor');
  const [saving, setSaving] = useState(false);

  function handleCreate(): void {
    if (!companyName.trim()) return;
    setSaving(true);
    try {
      addClient(companyName, channel);
      showToast('✓ Client created — direktang na-apply sa team roster');
      router.back();
    } catch (err) {
      if (err instanceof DuplicateTeamClientNameError) {
        Alert.alert('Duplicate', err.message);
      } else {
        Alert.alert('Error', (err as Error).message);
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <YStack flex={1} backgroundColor={BIZLINK_COLORS.canvas} paddingTop={insets.top}>
      <BizTopBar title="New Client" />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}>
        <BizCard flat marginBottom="$4">
          <XStack gap="$2" alignItems="center">
            <ClipboardList size={15} color={BIZLINK_COLORS.text} strokeWidth={1.75} />
            <Text fontSize={13} fontFamily={BIZLINK_FONTS.semibold} color={BIZLINK_COLORS.text}>Manager creation — no approval needed</Text>
          </XStack>
          <Text fontSize={13} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted} marginTop="$1">
            Bilang manager, direktang mapupunta ito sa team roster — ikaw na mismo ang
            mag-a-approve kung agent pa ang gumawa nito, kaya diretso na.
          </Text>
        </BizCard>

        <BizField
          label="Company Name *"
          value={companyName}
          onChangeText={setCompanyName}
          placeholder="e.g. Oracle Petroleum"
        />

        <BizSectionHeader title="Sales channel" />
        <XStack gap="$2" flexWrap="wrap" marginBottom="$4">
          {SALES_CHANNELS.map((option) => (
            <BizChip
              key={option}
              label={option}
              selected={channel === option}
              onPress={() => setChannel(option)}
            />
          ))}
        </XStack>

        <BizButton
          label={saving ? 'Creating…' : 'Create Client'}
          onPress={handleCreate}
          disabled={!companyName.trim() || saving}
        />
      </ScrollView>
    </YStack>
  );
}
