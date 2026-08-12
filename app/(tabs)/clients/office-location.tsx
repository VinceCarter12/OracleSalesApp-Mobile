import { useCallback, useEffect, useMemo, useState } from 'react';
import { Animated, Keyboard, KeyboardAvoidingView, PanResponder, Platform, Pressable, ScrollView, StyleSheet, TextInput, useWindowDimensions } from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, Crosshair, Layers, MapPin, Search } from 'lucide-react-native';
import { Spinner, Text, View, YStack } from 'tamagui';
import { useSession } from '../../../lib/session-store';
import { getClientById, setOfficeLocation, hasOfficePin } from '../../../lib/client-service';
import { getLatestClientOfficeMeetingGps } from '../../../lib/office-pin-service';
import { captureGps } from '../../../lib/gps';
import { isPhilippinesCoordinate, searchPhilippinesPlaces, validatePhilippinesCoordinate, type PhilippinesPlaceResult } from '../../../lib/philippines-place-search';
import { isLikelyOnline } from '../../../lib/sync/connectivity';
import { useBizlinkColors, BIZLINK_FONTS } from '../../../lib/theme';
import { showToast } from '../../../lib/toast';
import { LeafletWebViewMap, type MapTileType } from '../../../components/maps/LeafletWebViewMap';
import { OfficeLocationConfirmDialog } from '../../../components/maps/OfficeLocationConfirmDialog';
import type { Client } from '../../../types';

type SelectedPlace = { lat: number; lng: number; address: string; source: 'gps' | 'search' | 'drag' };

/** Cycle order for the floating map-style button — light ("white") is the default per Vince's reference. */
const TILE_CYCLE: MapTileType[] = ['light', 'dark', 'terrain'];

export default function OfficeLocationScreen() {
  const colors = useBizlinkColors();
  const { height: screenHeight } = useWindowDimensions();
  const { clientId } = useLocalSearchParams<{ clientId: string }>();
  const { profileId } = useSession();
  const [client, setClient] = useState<Client | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [confirmVisible, setConfirmVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<PhilippinesPlaceResult[]>([]);
  const [searched, setSearched] = useState(false);
  const [latestOfficeGps, setLatestOfficeGps] = useState<{ lat: number; lng: number; capturedAt: string | null; locationType: 'Client Office' } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [offlineNotice, setOfflineNotice] = useState<string | null>(null);
  const [selected, setSelected] = useState<SelectedPlace | null>(null);
  const [tileType, setTileType] = useState<MapTileType>('light');
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const collapsedHeight = 136;
  const expandedHeight = Math.min(Math.max(screenHeight * 0.58, 380), 500);
  const keyboardSafeExpandedHeight = keyboardHeight > 0
    ? Math.min(expandedHeight, Math.max(collapsedHeight, screenHeight - keyboardHeight))
    : expandedHeight;
  const [sheetHeight] = useState(() => new Animated.Value(collapsedHeight));
  const currentPin = useMemo(() => selected ?? (client && hasOfficePin(client.office_lat, client.office_lng)
    ? { lat: client.office_lat as number, lng: client.office_lng as number, address: client.office_address ?? 'Current office location', source: 'drag' as const }
    : latestOfficeGps?.locationType === 'Client Office' ? { lat: latestOfficeGps.lat, lng: latestOfficeGps.lng, address: 'Latest Client Office meeting GPS', source: 'gps' as const } : null), [client, latestOfficeGps, selected]);

  const loadClient = useCallback(async () => {
    if (!clientId) return;
    const [found, officeGps] = await Promise.all([getClientById(clientId), getLatestClientOfficeMeetingGps(clientId)]);
    setClient(found ?? null);
    setLatestOfficeGps(officeGps);
    setLoading(false);
  }, [clientId]);
  useEffect(() => { void loadClient(); }, [loadClient]);
  useFocusEffect(useCallback(() => { void loadClient(); }, [loadClient]));
  useEffect(() => {
    Animated.timing(sheetHeight, { toValue: expanded ? keyboardSafeExpandedHeight : collapsedHeight, duration: 260, useNativeDriver: false }).start();
  }, [collapsedHeight, expanded, keyboardSafeExpandedHeight, sheetHeight]);
  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', (event) => setKeyboardHeight(event.endCoordinates.height));
    const hide = Keyboard.addListener('keyboardDidHide', () => setKeyboardHeight(0));
    return () => { show.remove(); hide.remove(); };
  }, []);

  const panResponder = useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponder: (_, gesture) => Math.abs(gesture.dy) > 6,
    onPanResponderMove: (_, gesture) => {
      const startHeight = expanded ? keyboardSafeExpandedHeight : collapsedHeight;
      sheetHeight.setValue(Math.max(collapsedHeight, Math.min(keyboardSafeExpandedHeight, startHeight - gesture.dy)));
    },
    onPanResponderRelease: (_, gesture) => {
      const open = gesture.vy < -0.2 || gesture.dy < -50;
      setExpanded(open);
      Animated.spring(sheetHeight, { toValue: open ? keyboardSafeExpandedHeight : collapsedHeight, useNativeDriver: false }).start();
    },
  }), [collapsedHeight, expanded, keyboardSafeExpandedHeight, sheetHeight]);

  async function choosePin(pin: SelectedPlace): Promise<void> {
    setBusy(true); setError(null); setOfflineNotice(null);
    try {
      if (!isPhilippinesCoordinate(pin.lat, pin.lng)) throw new Error('Office pin must be within the Philippines.');
      if (await isLikelyOnline()) {
        setSelected({ ...pin, address: await validatePhilippinesCoordinate(pin.lat, pin.lng) });
      } else {
        setSelected(pin);
        setOfflineNotice('Offline: this pin is saved locally and will be verified when you are online.');
      }
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not verify this office location.'); }
    finally { setBusy(false); }
  }
  async function setHere(): Promise<void> { setBusy(true); setError(null); try { const gps = await captureGps(); await choosePin({ ...gps, address: 'Your current location', source: 'gps' }); } catch (e) { setError(e instanceof Error ? e.message : 'Could not get your current location.'); } finally { setBusy(false); } }
  const search = useCallback(async (text = query): Promise<void> => {
    if (text.trim().length < 3) { setResults([]); setSearched(false); return; }
    setBusy(true); setSearched(true); setError(null);
    try { setResults(await searchPhilippinesPlaces(text)); }
    catch (e) { setResults([]); setError(e instanceof Error ? e.message : 'Could not search places.'); }
    finally { setBusy(false); }
  }, [query]);
  useEffect(() => {
    if (query.trim().length < 3) { setResults([]); setSearched(false); return; }
    const timer = setTimeout(() => { void search(query); }, 450);
    return () => clearTimeout(timer);
  }, [query, search]);
  function confirmSave(): void { if (!selected || saving) return; setConfirmVisible(true); }
  async function save(): Promise<void> { setConfirmVisible(false); if (!clientId || !profileId || !selected) return; setSaving(true); setError(null); try { await setOfficeLocation({ clientId, agentId: profileId, lat: selected.lat, lng: selected.lng, source: 'manual' }); showToast('Office location saved.'); await loadClient(); setSelected(null); setExpanded(false); } catch (e) { setError(e instanceof Error ? e.message : 'Could not save office location.'); } finally { setSaving(false); } }
  function cycleTileType(): void { setTileType((current) => TILE_CYCLE[(TILE_CYCLE.indexOf(current) + 1) % TILE_CYCLE.length]); }
  function openSheet(): void { if (expanded) return; setExpanded(true); Animated.timing(sheetHeight, { toValue: keyboardSafeExpandedHeight, duration: 260, useNativeDriver: false }).start(); }

  if (loading) return <YStack flex={1} justifyContent="center" alignItems="center"><Spinner size="large" color={colors.brand} /></YStack>;
  if (!client) return <YStack flex={1} justifyContent="center" alignItems="center"><Text>Client not found.</Text></YStack>;
  const hasPin = hasOfficePin(client.office_lat, client.office_lng);
  const showResults = expanded && searched && query.trim().length >= 3 && !busy && results.length === 0 && !error;
  const statusLabel = hasPin ? 'Office pin set' : latestOfficeGps ? 'Client Office GPS available' : 'No office pin set';
  const sourceLabel = hasPin ? (client.office_pin_source === 'client_office_meeting' ? 'Source: Client Office meeting' : 'Source: Manual pin') : latestOfficeGps ? 'Latest start GPS from Client Office' : 'Choose a location to begin';
  return <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
    <View flex={1} backgroundColor={colors.canvas}>
    <LeafletWebViewMap markers={[]} onMarkerPress={() => {}} height={screenHeight} tileType={tileType} focusCoordinate={selected ? { lat: selected.lat, lng: selected.lng } : null} editablePin={currentPin ? { lat: currentPin.lat, lng: currentPin.lng, label: 'Office location' } : null} onPinDragEnd={({ lat, lng }) => { void choosePin({ lat, lng, address: 'Map location', source: 'drag' }); }} />
    <Pressable accessibilityLabel="Back" onPress={() => router.canGoBack() ? router.back() : router.replace('/(tabs)/clients')} style={[styles.floatingButton, styles.backButton]}><ArrowLeft size={21} color={colors.text} /></Pressable>
    <View style={styles.mapControls}>
      <Pressable accessibilityLabel={`Map style: ${tileType}`} onPress={cycleTileType} style={styles.floatingButton}><Layers size={19} color={colors.text} /></Pressable>
      <Pressable accessibilityLabel="Use your current location" onPress={() => { void setHere(); }} disabled={busy} style={styles.floatingButton}><Crosshair size={19} color={colors.text} /></Pressable>
    <OfficeLocationConfirmDialog visible={confirmVisible} onCancel={() => setConfirmVisible(false)} onConfirm={() => { void save(); }} />
    </View>
    <Animated.View style={[styles.sheet, { backgroundColor: colors.card, height: sheetHeight }]}>
      <View style={styles.handle} {...panResponder.panHandlers} />
      <View style={styles.sheetHeader} {...panResponder.panHandlers}>
        <View style={[styles.brandCircle, { backgroundColor: colors.brand }]}><MapPin size={16} color="#fff" /></View>
        <Text style={[styles.heading, { color: colors.text }]} numberOfLines={1}>{client.company_name}</Text>
        <View style={[styles.badge, { backgroundColor: colors.tintA }]}><Text style={[styles.badgeText, { color: colors.brand }]}>{hasPin ? 'SET' : 'NEW'}</Text></View>
      </View>
      <View style={styles.statusRow}><Text style={[styles.statusText, { color: colors.text }]}>{statusLabel}</Text><Text style={[styles.sourceText, { color: colors.muted }]}>{sourceLabel}</Text></View>
      <View style={[styles.searchRow, { backgroundColor: colors.soft }]}>
        <Search size={17} color={colors.muted} />
        <TextInput value={query} onChangeText={setQuery} onFocus={openSheet} onSubmitEditing={() => { void search(query); }} placeholder="Search place in the Philippines" placeholderTextColor={colors.muted} style={[styles.input, { color: colors.text }]} returnKeyType="search" />
      </View>
      {expanded ? <>
        {busy ? <View style={styles.resultsLoading}><Spinner size="small" color={colors.brand} /></View> : null}
        {results.length > 0 ? <ScrollView nestedScrollEnabled keyboardShouldPersistTaps="handled" style={styles.resultsScroll}>{results.map((result) => <Pressable key={result.id} accessibilityRole="button" accessibilityLabel={`Select ${result.name}`} onPress={() => { void choosePin({ lat: result.lat, lng: result.lng, address: result.address, source: 'search' }); }} style={[styles.result, { backgroundColor: colors.soft }]}><MapPin size={16} color={colors.brand} /><YStack flex={1}><Text style={{ color: colors.text, fontFamily: BIZLINK_FONTS.semibold, fontSize: 13 }} numberOfLines={1}>{result.name}</Text><Text style={{ color: colors.muted, fontSize: 12 }} numberOfLines={1}>{result.address}</Text></YStack></Pressable>)}</ScrollView> : null}
        {showResults ? <Text style={{ color: colors.muted, fontSize: 12, marginTop: 8 }}>No places found.</Text> : null}
        {error ? <Text style={{ color: colors.red, fontSize: 12, marginTop: 8 }}>{error}</Text> : null}
        {offlineNotice ? <Text style={[styles.offlineNote, { color: colors.muted }]}>{offlineNotice}</Text> : null}
        <Text style={[styles.offlineNote, { color: colors.muted }]}>Place suggestions need internet. New pins can be saved locally and verified when online; GPS, dragging, and saved office data remain available offline.</Text>
        <Pressable onPress={confirmSave} disabled={!selected || saving} style={[styles.save, { backgroundColor: selected && !saving ? colors.brand : colors.muted, opacity: selected && !saving ? 1 : 0.6 }]}><Text style={{ color: '#fff', fontFamily: BIZLINK_FONTS.semibold }}>{saving ? 'Saving…' : 'Confirm location'}</Text></Pressable>
      </> : <Text style={[styles.hint, { color: colors.muted }]}>Drag the pin or tap the search bar to set a location.</Text>}
    </Animated.View>
    </View>
  </KeyboardAvoidingView>;
}

const styles = StyleSheet.create({
  floatingButton: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 4, elevation: 4 },
  backButton: { position: 'absolute', top: 44, left: 16 },
  mapControls: { position: 'absolute', top: 44, right: 16, gap: 12 },
  sheet: { position: 'absolute', left: 0, right: 0, bottom: 0, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 16, paddingTop: 10, paddingBottom: 16, overflow: 'hidden' },
  handle: { width: 42, height: 4, borderRadius: 2, backgroundColor: '#CBD5E1', alignSelf: 'center', marginBottom: 10 },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 5 },
  brandCircle: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  heading: { flex: 1, fontFamily: BIZLINK_FONTS.semibold, fontSize: 16 },
  badge: { paddingHorizontal: 9, paddingVertical: 4, borderRadius: 999 },
  badgeText: { fontFamily: BIZLINK_FONTS.semibold, fontSize: 10, letterSpacing: 0.4 },
  statusRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, gap: 8 },
  statusText: { fontFamily: BIZLINK_FONTS.semibold, fontSize: 12 },
  sourceText: { flex: 1, textAlign: 'right', fontSize: 11 },
  searchRow: { height: 48, borderRadius: 999, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 10 },
  input: { flex: 1, fontFamily: BIZLINK_FONTS.medium, fontSize: 14 },
  resultsLoading: { paddingVertical: 10, alignItems: 'center' },
  resultsScroll: { maxHeight: 164, marginTop: 10 },
  result: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 14, padding: 12, marginBottom: 8 },
  save: { height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginTop: 10 },
  hint: { fontFamily: BIZLINK_FONTS.medium, fontSize: 12, marginTop: 2 },
  offlineNote: { fontSize: 10, lineHeight: 14, marginTop: 8 },
});
