import { useEffect, useRef, useState } from 'react';
import { Alert, ScrollView, Image } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import * as Location from 'expo-location';
import * as ImagePicker from 'expo-image-picker';
import { Button, Checkbox, Label, Separator, Spinner, Text, XStack, YStack } from 'tamagui';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../lib/useAuth';
import { MEETING_AGENDAS, MEETING_OUTCOMES } from '../../../types';

export default function RecordMeetingScreen() {
  const { clientId } = useLocalSearchParams<{ clientId?: string }>();
  const { session } = useAuth();

  const [selectedAgendas, setSelectedAgendas] = useState<string[]>([]);
  const [outcome, setOutcome] = useState<string>(MEETING_OUTCOMES[0]);
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [loadingLocation, setLoadingLocation] = useState(false);
  const [saving, setSaving] = useState(false);

  // Auto-capture GPS on mount
  useEffect(() => {
    captureLocation();
  }, []);

  async function captureLocation() {
    setLoadingLocation(true);
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission denied', 'Location permission is required to record a meeting.');
      setLoadingLocation(false);
      return;
    }
    const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
    setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
    setLoadingLocation(false);
  }

  async function captureSelfie() {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission denied', 'Camera permission is required for selfie capture.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.7,
      allowsEditing: false,
    });
    if (!result.canceled && result.assets.length > 0) {
      setPhotoUri(result.assets[0].uri);
    }
  }

  function toggleAgenda(agenda: string) {
    setSelectedAgendas((prev) =>
      prev.includes(agenda) ? prev.filter((a) => a !== agenda) : [...prev, agenda]
    );
  }

  async function handleSave() {
    if (!location) {
      Alert.alert('GPS Required', 'Wait for GPS location to be captured before saving.');
      return;
    }
    if (!photoUri) {
      Alert.alert('Selfie Required', 'Please capture a selfie before saving.');
      return;
    }

    setSaving(true);

    // Upload photo to Supabase Storage
    let photoUrl: string | null = null;
    try {
      const ext = photoUri.split('.').pop() ?? 'jpg';
      const fileName = `meetings/${session?.user.id}/${Date.now()}.${ext}`;
      const response = await fetch(photoUri);
      const blob = await response.blob();
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('meeting-photos')
        .upload(fileName, blob, { contentType: `image/${ext}` });
      if (uploadError) throw uploadError;
      const { data: publicUrlData } = supabase.storage
        .from('meeting-photos')
        .getPublicUrl(fileName);
      photoUrl = publicUrlData.publicUrl;
    } catch (err: any) {
      Alert.alert('Upload Error', err.message ?? 'Failed to upload photo.');
      setSaving(false);
      return;
    }

    const { error } = await supabase.from('meetings').insert({
      client_id: clientId ?? null,
      agent_id: session?.user.id,
      gps_lat: location.lat,
      gps_lng: location.lng,
      selfie_url: photoUrl,
      agendas: selectedAgendas,
      outcome,
      logged_at: new Date().toISOString(),
    });

    setSaving(false);
    if (error) {
      Alert.alert('Error', error.message);
    } else {
      router.back();
    }
  }

  return (
    <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
      <YStack flex={1} padding="$6" gap="$5" backgroundColor="$background">
        <Text fontSize="$6" fontWeight="700">Record Meeting</Text>

        {/* GPS */}
        <YStack gap="$2">
          <Label>GPS Location</Label>
          {loadingLocation ? (
            <XStack gap="$2" alignItems="center">
              <Spinner size="small" />
              <Text color="$colorPress">Capturing location…</Text>
            </XStack>
          ) : location ? (
            <Text fontSize="$3" color="$colorPress">
              {location.lat.toFixed(6)}, {location.lng.toFixed(6)}
            </Text>
          ) : (
            <Button size="$3" onPress={captureLocation}>Retry GPS</Button>
          )}
        </YStack>

        <Separator />

        {/* Selfie */}
        <YStack gap="$2">
          <Label>Selfie Photo *</Label>
          {photoUri ? (
            <YStack gap="$2">
              <Image
                source={{ uri: photoUri }}
                style={{ width: '100%', height: 200, borderRadius: 8 }}
                resizeMode="cover"
              />
              <Button size="$3" onPress={captureSelfie}>Retake</Button>
            </YStack>
          ) : (
            <Button size="$3" onPress={captureSelfie}>Open Camera</Button>
          )}
        </YStack>

        <Separator />

        {/* Agenda */}
        <YStack gap="$2">
          <Label>Agenda (select all that apply)</Label>
          {MEETING_AGENDAS.map((agenda) => (
            <XStack key={agenda} gap="$3" alignItems="center">
              <Checkbox
                id={agenda}
                size="$4"
                checked={selectedAgendas.includes(agenda)}
                onCheckedChange={() => toggleAgenda(agenda)}
              >
                <Checkbox.Indicator>
                  <Text>✓</Text>
                </Checkbox.Indicator>
              </Checkbox>
              <Label htmlFor={agenda}>{agenda}</Label>
            </XStack>
          ))}
        </YStack>

        <Separator />

        {/* Outcome */}
        <YStack gap="$2">
          <Label>Meeting Outcome</Label>
          {MEETING_OUTCOMES.map((o) => (
            <Button
              key={o}
              size="$3"
              theme={outcome === o ? 'active' : undefined}
              onPress={() => setOutcome(o)}
            >
              {o}
            </Button>
          ))}
        </YStack>

        <Button
          size="$4"
          marginTop="$4"
          onPress={handleSave}
          disabled={saving}
          theme="active"
          icon={saving ? <Spinner /> : undefined}
        >
          {saving ? 'Saving…' : 'Save Meeting'}
        </Button>
      </YStack>
    </ScrollView>
  );
}
