import { useState } from 'react';
import { Alert, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { ClipboardList } from 'lucide-react-native';
import { Text, XStack, YStack } from 'tamagui';
import { COLORS } from '../../../../lib/theme';
import { showToast } from '../../../../lib/toast';
import { DuplicateTeamClientNameError, useManagerStore } from '../../../../lib/manager-store';
import { TopBar } from '../../../../components/ui/TopBar';
import { Field } from '../../../../components/ui/Field';
import { Card } from '../../../../components/ui/Card';
import { SectionHeader } from '../../../../components/ui/SectionHeader';
import { SelectTile } from '../../../../components/ui/SelectTile';
import { DuoButton } from '../../../../components/ui/DuoButton';
import { SALES_CHANNELS, type SalesChannel } from '../../../../types';

/**
 * Manager Create Client — a manager can create clients same as an agent, but
 * it applies directly to the team roster with no approval step, since the
 * Sales Manager is the one who'd approve it anyway. Mirrors
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
    <YStack flex={1} backgroundColor={COLORS.snow} paddingTop={insets.top}>
      <TopBar title="New Client" />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}>
        <Card flat marginBottom="$4">
          <XStack gap="$2" alignItems="center">
            <ClipboardList size={15} color={COLORS.eel} />
            <Text fontSize={13} fontWeight="800" color={COLORS.eel}>Manager creation — no approval needed</Text>
          </XStack>
          <Text fontSize={13} fontWeight="600" color={COLORS.hare} marginTop="$1">
            Bilang manager, direktang mapupunta ito sa team roster — ikaw na mismo ang
            mag-a-approve kung agent pa ang gumawa nito, kaya diretso na.
          </Text>
        </Card>

        <Field
          label="Company Name *"
          value={companyName}
          onChangeText={setCompanyName}
          placeholder="e.g. Oracle Petroleum"
        />

        <SectionHeader title="Sales channel" />
        <XStack gap="$2" flexWrap="wrap" marginBottom="$4">
          {SALES_CHANNELS.map((option) => (
            <SelectTile
              key={option}
              label={option}
              selected={channel === option}
              onPress={() => setChannel(option)}
            />
          ))}
        </XStack>

        <DuoButton
          label={saving ? 'Creating…' : 'Create Client'}
          onPress={handleCreate}
          disabled={!companyName.trim() || saving}
        />
      </ScrollView>
    </YStack>
  );
}
