import { useEffect, useState } from 'react';
import { Alert, ScrollView } from 'react-native';
import { router } from 'expo-router';
import { ClipboardList, Lightbulb } from 'lucide-react-native';
import { Text, XStack, YStack } from 'tamagui';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../lib/useAuth';
import { COLORS } from '../../../lib/theme';
import { showToast } from '../../../lib/toast';
import { TopBar } from '../../../components/ui/TopBar';
import { Field } from '../../../components/ui/Field';
import { Card } from '../../../components/ui/Card';
import { DuoButton } from '../../../components/ui/DuoButton';

type DupState = 'idle' | 'checking' | 'duplicate' | 'available';

/**
 * Two-phase client creation (F-001, Wireframe a-createclient): company name
 * only. The rest of the info has a 1-month completion window (Complete Info),
 * or gets captured in the first meeting.
 */
export default function CreateClientScreen() {
  const { session } = useAuth();
  const [companyName, setCompanyName] = useState('');
  const [dupState, setDupState] = useState<DupState>('idle');
  const [saving, setSaving] = useState(false);

  // Debounced duplicate check against the server list (ADR-003 — the local
  // snapshot version arrives with T-005).
  useEffect(() => {
    const name = companyName.trim();
    if (!name) {
      setDupState('idle');
      return;
    }
    setDupState('checking');
    const timer = setTimeout(() => {
      supabase
        .from('clients')
        .select('id')
        .ilike('company_name', name)
        .limit(1)
        .then(({ data }) => {
          setDupState(data && data.length > 0 ? 'duplicate' : 'available');
        });
    }, 400);
    return () => clearTimeout(timer);
  }, [companyName]);

  async function handleCreate(): Promise<void> {
    if (!session) {
      Alert.alert('Not signed in', 'Sign in again before creating a client.');
      return;
    }
    setSaving(true);
    const { error } = await supabase.from('clients').insert({
      company_name: companyName.trim(),
      contact_person: '',
      position: null,
      contact_number: null,
      office_address: null,
      // Legacy column kept for DB compat — the two-phase form no longer asks
      // for this; Complete Info (a-complete) collects sales_channel instead.
      customer_type: 'Dealer',
      sales_channel: 'Distributor',
      status: 'prospect',
      agent_id: session.user.id,
    });
    setSaving(false);
    if (error) {
      Alert.alert('Error', error.message);
    } else {
      showToast('✓ Client created — kumpletuhin ang info within 1 month');
      router.back();
    }
  }

  const canCreate = dupState === 'available' && !saving;

  return (
    <YStack flex={1} backgroundColor={COLORS.snow}>
      <TopBar title="New Client" />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}>
        <Card flat marginBottom="$4">
          <XStack gap="$2" alignItems="center">
            <ClipboardList size={15} color={COLORS.eel} />
            <Text fontSize={13} fontWeight="800" color={COLORS.eel}>Two-phase creation</Text>
          </XStack>
          <Text fontSize={13} fontWeight="600" color={COLORS.hare} marginTop="$1">
            Company name lang ang kailangan ngayon. May <Text fontWeight="800" color={COLORS.eel}>1 buwan</Text> ka
            para kumpletuhin ang buong info — o kumpletuhin ito mismo sa unang meeting.
          </Text>
        </Card>

        <Field
          label="Company Name *"
          value={companyName}
          onChangeText={setCompanyName}
          placeholder="e.g. Oracle Petroleum (Pampanga)"
          hint={
            dupState === 'duplicate' ? (
              <Text
                fontSize={11.5}
                fontWeight="700"
                backgroundColor={COLORS.redSoft}
                color={COLORS.ledgeRed}
                borderRadius={10}
                paddingHorizontal={12}
                paddingVertical={8}
              >
                May client nang ganitong pangalan — bawal ang duplicate.
              </Text>
            ) : dupState === 'available' ? (
              <Text
                fontSize={11.5}
                fontWeight="700"
                backgroundColor={COLORS.greenSoft}
                color={COLORS.ledgeGreen}
                borderRadius={10}
                paddingHorizontal={12}
                paddingVertical={8}
              >
                ✓ Available ang pangalang ito.
              </Text>
            ) : null
          }
        />

        <XStack gap="$2" alignItems="flex-start" marginBottom="$4">
          <Lightbulb size={14} color={COLORS.hare} style={{ marginTop: 2 }} />
          <Text fontSize={13} fontWeight="600" color={COLORS.hare} flex={1}>
            Bawal ang duplicate — pero pwede ang parehong company na may ibang area, hal. “Oracle
            Petroleum (Bataan)” at “Oracle Petroleum (Pampanga)”.
          </Text>
        </XStack>

        <DuoButton
          label={saving ? 'Creating…' : 'Create Client'}
          onPress={handleCreate}
          disabled={!canCreate}
        />
        <Text fontSize={13} fontWeight="600" color={COLORS.hare} textAlign="center" marginTop="$3">
          Gagana kahit OFFLINE — sa sync queue mapupunta.
        </Text>
      </ScrollView>
    </YStack>
  );
}
