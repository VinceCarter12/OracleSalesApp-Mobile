import { useEffect, useState } from 'react';
import { Alert, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { ClipboardList, Lightbulb } from 'lucide-react-native';
import { Text, XStack, YStack } from 'tamagui';
import { useSession } from '../../../lib/session-store';
import { checkCompanyNameDuplicate, createClient, DuplicateCompanyNameError } from '../../../lib/client-service';
import { BIZLINK_COLORS, BIZLINK_FONTS } from '../../../lib/theme';
import { showToast } from '../../../lib/toast';
import { BizTopBar } from '../../../components/bizlink/BizTopBar';
import { BizField } from '../../../components/bizlink/BizField';
import { BizCard } from '../../../components/bizlink/BizCard';
import { BizButton } from '../../../components/bizlink/BizButton';

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
    <YStack flex={1} backgroundColor={BIZLINK_COLORS.canvas} paddingTop={insets.top}>
      <BizTopBar title="New Client" />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}>
        <BizCard flat marginBottom="$4">
          <XStack gap="$2" alignItems="center">
            <ClipboardList size={15} color={BIZLINK_COLORS.text} strokeWidth={1.75} />
            <Text fontSize={13} fontFamily={BIZLINK_FONTS.semibold} color={BIZLINK_COLORS.text}>Two-phase creation</Text>
          </XStack>
          <Text fontSize={13} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted} marginTop="$1">
            Company name lang ang kailangan ngayon. May{' '}
            <Text fontFamily={BIZLINK_FONTS.semibold} color={BIZLINK_COLORS.text}>1 buwan</Text> ka
            para kumpletuhin ang buong info — o kumpletuhin ito mismo sa unang meeting.
          </Text>
        </BizCard>

        <BizField
          label="COMPANY NAME *"
          value={companyName}
          onChangeText={setCompanyName}
          placeholder="e.g. Oracle Petroleum"
          hint={
            dupState === 'duplicate' ? (
              <Text
                fontSize={11.5}
                fontFamily={BIZLINK_FONTS.semibold}
                backgroundColor={BIZLINK_COLORS.tintB}
                color={BIZLINK_COLORS.red}
                borderRadius={14}
                paddingHorizontal={13}
                paddingVertical={9}
              >
                May client nang ganitong pangalan sa city na ito — bawal ang duplicate.
              </Text>
            ) : dupState === 'available' ? (
              <Text
                fontSize={11.5}
                fontFamily={BIZLINK_FONTS.semibold}
                backgroundColor={BIZLINK_COLORS.tintA}
                color={BIZLINK_COLORS.ink}
                borderRadius={14}
                paddingHorizontal={13}
                paddingVertical={9}
              >
                ✓ Available ang pangalang ito.
              </Text>
            ) : null
          }
        />

        <BizField
          label="CITY *"
          value={city}
          onChangeText={setCity}
          placeholder="e.g. Cabanatuan"
        />

        <XStack gap="$2" alignItems="flex-start" marginBottom="$4">
          <Lightbulb size={14} color={BIZLINK_COLORS.muted} strokeWidth={1.75} style={{ marginTop: 2 }} />
          <Text fontSize={13} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted} flex={1}>
            Bawal ang duplicate na parehong pangalan sa parehong city — pero pwede ang parehong
            company name kung ibang city, hal. Oracle Petroleum sa Bataan at sa Pampanga.
          </Text>
        </XStack>

        <BizButton
          label={saving ? 'Creating…' : 'Create Client'}
          onPress={handleCreate}
          disabled={!canCreate}
        />
        <Text fontSize={13} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted} textAlign="center" marginTop="$3">
          Gagana kahit OFFLINE — sa sync queue mapupunta.
        </Text>
      </ScrollView>
    </YStack>
  );
}
