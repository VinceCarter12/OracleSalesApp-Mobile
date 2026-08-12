import { useEffect, useState } from 'react';
import { Alert, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { ClipboardList, Info, Lightbulb } from 'lucide-react-native';
import { Spinner, Text, XStack, YStack } from 'tamagui';
import { useSession } from '../../../lib/session-store';
import { checkCompanyNameDuplicate, checkLocalDuplicate, createClient, DuplicateCompanyNameError } from '../../../lib/client-service';
import { AccountSuspendedError } from '../../../lib/app-lock/account-status';
import { useBizlinkColors, BIZLINK_FONTS, BIZLINK_ON_INK } from '../../../lib/theme';
import { showToast } from '../../../lib/toast';
import { BizTopBar } from '../../../components/bizlink/BizTopBar';
import { BizField } from '../../../components/bizlink/BizField';
import { BizCard } from '../../../components/bizlink/BizCard';
import { BizButton } from '../../../components/bizlink/BizButton';
import { KeyboardAwareScrollView } from '../../../components/ui/KeyboardAwareScrollView';
import { CityMunicipalitySelector } from '../../../components/bizlink/CityMunicipalitySelector';
import { COMPANY_NAME_MAX_LENGTH } from '../../../lib/field-validation';
import { useClientFlowRoutes } from '../../../lib/use-role-routes';
import type { PsgcLocality } from '../../../lib/data/psgc-localities';

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
  const BIZLINK_COLORS = useBizlinkColors();
  const { profileId, markSuspended } = useSession();
  const routes = useClientFlowRoutes();
  const [companyName, setCompanyName] = useState('');
  const [selectedLocality, setSelectedLocality] = useState<PsgcLocality | null>(null);
  const [dupState, setDupState] = useState<DupState>('idle');
  const [saving, setSaving] = useState(false);

  // Debounced duplicate check (T-005, sped up B-020): the button gates on a
  // LOCAL-only check (SQLite rows + snapshot cache) — sub-millisecond, so it
  // no longer waits on a live Supabase round-trip (up to 8s) before
  // activating. The full check (local + live) still runs in the background
  // right after, purely to surface an early "may duplicate na sa server"
  // hint — it can arrive late without blocking anything, since createClient()
  // re-runs the full check as the actual write-time safety gate anyway.
  useEffect(() => {
    const name = companyName.trim();
    const cityValue = selectedLocality?.name.trim() ?? '';
    if (!name || !cityValue) {
      setDupState('idle');
      return;
    }
    setDupState('checking');
    let cancelled = false;
    const timer = setTimeout(async () => {
      const local = await checkLocalDuplicate(name, cityValue);
      if (cancelled) return;
      if (local === 'duplicate') {
        setDupState('duplicate');
        return;
      }
      setDupState('available');
      // Background-only from here — never re-blocks the button; only
      // downgrades to 'duplicate' if the live check lands before submit.
      checkCompanyNameDuplicate(name, cityValue).then((result) => {
        if (!cancelled && result === 'duplicate') setDupState('duplicate');
      });
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [companyName, selectedLocality]);

  async function handleCreate(): Promise<void> {
    if (!profileId) {
      Alert.alert('Not signed in', 'Sign in again before creating a client.');
      return;
    }
    setSaving(true);
    try {
      const city = selectedLocality?.name.trim() ?? '';
      await createClient({ companyName, city, agentId: profileId });
      showToast('✓ Client created — complete the info within 1 month');
      if (router.canGoBack()) {
        router.back();
      } else {
        router.replace(routes.clientList());
      }
    } catch (err) {
      if (err instanceof AccountSuspendedError) {
        // Batch 5 Slice 2 (ADR-051): route to AccountSuspendedScreen instead
        // of showing a generic save error — never swallow this silently.
        markSuspended();
      } else if (err instanceof DuplicateCompanyNameError) {
        setDupState('duplicate');
        Alert.alert('Duplicate', err.message);
      } else {
        Alert.alert('Error', (err as Error).message);
      }
    } finally {
      setSaving(false);
    }
  }

  const canCreate = dupState === 'available' && selectedLocality !== null && !saving;

  return (
    <YStack flex={1} backgroundColor={BIZLINK_COLORS.canvas} paddingTop={insets.top}>
      <BizTopBar title="New Client" fallbackHref={routes.clientList()} />
      <KeyboardAwareScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }} keyboardShouldPersistTaps="handled">
        <BizCard flat marginBottom="$4">
          <XStack gap="$2" alignItems="center">
            <ClipboardList size={15} color={BIZLINK_COLORS.text} strokeWidth={1.75} />
            <Text fontSize={13} fontFamily={BIZLINK_FONTS.semibold} color={BIZLINK_COLORS.text}>Create a client in two steps</Text>
          </XStack>
          <Text fontSize={13} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted} marginTop="$1">
            Only the company name and the city you picked are needed for now. You
            have <Text fontFamily={BIZLINK_FONTS.semibold} color={BIZLINK_COLORS.text}>1 month</Text> to
            complete the rest of the info, or finish it at the first meeting.
          </Text>
        </BizCard>

        <BizField
          label="COMPANY NAME *"
          value={companyName}
          onChangeText={setCompanyName}
          placeholder="e.g. Oracle Petroleum"
          maxLength={COMPANY_NAME_MAX_LENGTH}
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
                A client with this name already exists in this city — duplicates aren't allowed.
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
                ✓ This name is available.
              </Text>
            ) : null
          }
        />

        <YStack marginBottom="$3.5" gap="$1.5">
          <Text fontSize={11} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted} letterSpacing={0.4}>
            CITY / MUNICIPALITY *
          </Text>
          <CityMunicipalitySelector value={selectedLocality} onSelect={setSelectedLocality} />
        </YStack>

        <XStack gap="$2" alignItems="flex-start" marginBottom="$3">
          <Info size={14} color={BIZLINK_COLORS.muted} strokeWidth={1.75} style={{ marginTop: 2 }} />
          <Text fontSize={13} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted} flex={1}>
            Pick the city from the list. Free text can't be saved.
          </Text>
        </XStack>

        <XStack gap="$2" alignItems="flex-start" marginBottom="$4">
          <Lightbulb size={14} color={BIZLINK_COLORS.muted} strokeWidth={1.75} style={{ marginTop: 2 }} />
          <Text fontSize={13} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted} flex={1}>
            Duplicates aren't allowed — but the same company can appear with a different area, e.g.
            &quot;Oracle Petroleum (Bataan)&quot; and &quot;Oracle Petroleum (Pampanga)&quot;.
          </Text>
        </XStack>

        <BizButton
          label={saving ? 'Creating…' : 'Create client'}
          onPress={handleCreate}
          disabled={!canCreate}
          icon={saving ? <Spinner color={BIZLINK_ON_INK.solid} /> : undefined}
        />
        <Text fontSize={13} fontFamily={BIZLINK_FONTS.medium} color={BIZLINK_COLORS.muted} textAlign="center" marginTop="$3">
          Gagana kahit OFFLINE — sa sync queue mapupunta.
        </Text>
      </KeyboardAwareScrollView>
    </YStack>
  );
}
