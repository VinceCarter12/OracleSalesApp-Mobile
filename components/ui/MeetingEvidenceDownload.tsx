import { useRef, useState } from 'react';
import { Alert, Image, StyleSheet, View } from 'react-native';
import * as MediaLibrary from 'expo-media-library';
import ViewShot from 'react-native-view-shot';
import { Download } from 'lucide-react-native';
import { Text, YStack } from 'tamagui';
import { BizButton } from '../bizlink/BizButton';
import { BIZLINK_FONTS, useBizlinkColors } from '../../lib/theme';

export interface MeetingEvidenceAuditDetails {
  title: string;
  capturedAt: string | null | undefined;
  clientStatus: string;
  location: string;
  duration: string;
}

interface MeetingEvidenceDownloadProps {
  imageUrl: string;
  details: MeetingEvidenceAuditDetails;
}

function displayDate(iso: string | null | undefined): string {
  return iso ? new Date(iso).toLocaleString() : 'Not recorded';
}

/**
 * Saves a second, audit-ready image. The original evidence is not altered;
 * this rendered copy visibly carries the meeting facts needed outside the app.
 */
export function MeetingEvidenceDownload({ imageUrl, details }: MeetingEvidenceDownloadProps) {
  const BIZLINK_COLORS = useBizlinkColors();
  const shotRef = useRef<any>(null);
  const [saving, setSaving] = useState(false);
  const [imageReady, setImageReady] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);

  async function saveAuditCopy(): Promise<void> {
    if (!imageReady) {
      Alert.alert('Please wait', 'The evidence image is still loading. Try again in a moment.');
      return;
    }
    setSaving(true);
    try {
      const permission = await MediaLibrary.requestPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Photo permission needed', 'Allow photo access to save the meeting evidence copy to this device.');
        return;
      }
      const uri = await shotRef.current?.capture?.({ format: 'jpg', quality: 0.94, result: 'tmpfile' });
      if (!uri) throw new Error('Evidence image could not be prepared.');
      await MediaLibrary.Asset.create(uri);
      Alert.alert('Saved', 'The photo was saved with its timestamp, client status, location, time, and duration.');
    } catch (error) {
      console.error('[MeetingEvidenceDownload] save failed:', error instanceof Error ? error.message : String(error));
      Alert.alert('Could not save photo', 'Please try again after the image has finished loading.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <YStack gap="$1.5" marginTop="$3">
        <Text fontFamily={BIZLINK_FONTS.medium} fontSize={11.5} color={BIZLINK_COLORS.muted}>
          {imageFailed
            ? 'The evidence image could not be loaded for download.'
            : 'Download includes the meeting audit details on the image.'}
        </Text>
        <BizButton
          label={saving ? 'Saving…' : 'Download audit copy'}
          small
          disabled={saving || !imageReady || imageFailed}
          icon={<Download size={15} color="#FFFFFF" />}
          onPress={saveAuditCopy}
        />
      </YStack>

      <View style={styles.captureHost} pointerEvents="none">
        <ViewShot ref={shotRef} options={{ format: 'jpg', quality: 0.94, result: 'tmpfile' }}>
          <View style={styles.canvas}>
            <Image
              source={{ uri: imageUrl }}
              style={styles.photo}
              resizeMode="cover"
              onLoadEnd={() => setImageReady(true)}
              onError={() => setImageFailed(true)}
            />
            <View style={styles.overlay}>
              <Text style={styles.title}>{details.title}</Text>
              <Text style={styles.line}>Timestamp: {displayDate(details.capturedAt)}</Text>
              <Text style={styles.line}>Client status: {details.clientStatus}</Text>
              <Text style={styles.line}>Location: {details.location}</Text>
              <Text style={styles.line}>Duration: {details.duration}</Text>
            </View>
          </View>
        </ViewShot>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  captureHost: { position: 'absolute', top: 0, left: 0, width: 1080, height: 1350, zIndex: -1, opacity: 0.01 },
  canvas: { width: 1080, height: 1350, backgroundColor: '#FFFFFF' },
  photo: { width: 1080, height: 1080 },
  overlay: { flex: 1, backgroundColor: '#073C2A', paddingHorizontal: 48, paddingVertical: 28 },
  title: { color: '#FFFFFF', fontSize: 30, fontWeight: '700', marginBottom: 12 },
  line: { color: '#E8F8EF', fontSize: 22, lineHeight: 31 },
});
