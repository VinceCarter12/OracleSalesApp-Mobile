import { useEffect, useState } from 'react';
import { Alert, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { ClipboardList, Lightbulb } from 'lucide-react-native';
import { Text, XStack, YStack } from 'tamagui';
import { useSession } from '../../../lib/session-store';
import { checkCompanyNameDuplicate, createClient, DuplicateCompanyNameError } from '../../../lib/client-service';
import { COLORS } from '../../../lib/theme';
import { showToast } from '../../../lib/toast';
import { TopBar } from '../../../components/ui/TopBar';
import { Field } from '../../../components/ui/Field';
import { Card } from '../../../components/ui/Card';
import { DuoButton } from '../../../components/ui/DuoButton';

// 'unknown' (offline, live check failed and nothing local matched) is
// treated as available — same soft-warning UX as before T-005, since the
// server unique constraint (once Migration 014 lands) is the final
// authority at sync time (ADR-003).
type DupState = 'idle' | 'checking' | 'duplicate' | 'available';

/**
 * Two-phase client creation (F-001, Wireframe a-createclient): company name
 * only. The rest of the info has a 1-month completion window (Complete Info),
 * or gets captured in the first meeting.
 *
 * T-002/T-003: writes to local SQLite + outbox first (offline-first,
 * ADR-001/002/004) — never a direct Supabase insert. The sync engine (T-002)
 * pushes the outbox row when connectivity allows.
 */
export default function CreateClientScreen() {
  const insets = useSafeAreaInsets();
  const { profileId } = useSession();
  const [companyName, setCompanyName] = useState('');
  const [city, setCity] = useState('');
  const [dupState, setDupState] = useState<DupState>('idle');
  const [saving, setSaving] = useState(false);

  // Debounced duplicate check (T-005): local clients rows (any sync
  // state) → local snapshot → live Supabase, in that order — see
  // lib/client-service.ts. City is collected right here (2026-07-15
  // revision — an agent always knows the city they're in), so this is a
  // hard (name, city) check, not a deferred soft warning.
  useEffect(() => {
    const name = companyName.trim();
    const cityValue = city.trim();
    if (!name || !cityValue) {
      setDupState('idle');
      return;
    }
    setDupState('checking');
    const timer = setTimeout(async () => {
      const result = await checkCompanyNameDuplicate(name, cityValue);
      setDupState(result === 'duplicate' ? 'duplicate' : 'available');
    }, 400);
    return () => clearTimeout(timer);
  }, [companyName, city]);

  async function handleCreate(): Promise<void> {
    if (!profileId) {
      Alert.alert('Not signed in', 'Sign in again before creating a client.');
      return;
    }
    setSaving(true);
    try {
      await createClient({ companyName, city, agentId: profileId });
      showToast('✓ Client created — kumpletuhin ang info within 1 month');
      router.back();
    } catch (err) {
      if (err instanceof DuplicateCompanyNameError) {
        setDupState('duplicate');
        Alert.alert('Duplicate', err.message);
      } else {
        Alert.alert('Error', (err as Error).message);
      }
    } finally {
      setSaving(false);
    }
  }

  const canCreate = dupState === 'available' && !saving;

  return (
    <YStack flex={1} backgroundColor={COLORS.snow} paddingTop={insets.top}>
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
          placeholder="e.g. Oracle Petroleum"
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
                May client nang ganitong pangalan sa city na ito — bawal ang duplicate.
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

        <Field
          label="City *"
          value={city}
          onChangeText={setCity}
          placeholder="e.g. Cabanatuan"
        />

        <XStack gap="$2" alignItems="flex-start" marginBottom="$4">
          <Lightbulb size={14} color={COLORS.hare} style={{ marginTop: 2 }} />
          <Text fontSize={13} fontWeight="600" color={COLORS.hare} flex={1}>
            Bawal ang duplicate na parehong pangalan sa parehong city — pero pwede ang parehong
            company name kung ibang city, hal. Oracle Petroleum sa Bataan at sa Pampanga.
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
