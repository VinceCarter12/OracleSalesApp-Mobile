import { supabase } from './supabase';
import type { MeetingMode, MeetingOutcome } from '../types';

const MEETING_PHOTO_BUCKET = 'meeting-photos';

/** Uploads a locally captured photo to Supabase Storage and returns its public URL. */
export async function uploadMeetingPhoto(
  localUri: string,
  userId: string,
  kind: 'selfie' | 'start' | 'end'
): Promise<string> {
  const ext = localUri.split('.').pop() ?? 'jpg';
  const fileName = `meetings/${userId}/${Date.now()}-${kind}.${ext}`;
  const response = await fetch(localUri);
  const blob = await response.blob();
  const { error } = await supabase.storage
    .from(MEETING_PHOTO_BUCKET)
    .upload(fileName, blob, { contentType: `image/${ext}` });
  if (error) throw error;
  const { data } = supabase.storage.from(MEETING_PHOTO_BUCKET).getPublicUrl(fileName);
  return data.publicUrl;
}

export interface NewMeetingRecord {
  client_id: string | null;
  agent_id: string;
  gps_lat: number;
  gps_lng: number;
  meeting_mode: MeetingMode;
  agendas: string[];
  outcome: MeetingOutcome | null;
  selfie_url?: string | null;
  start_photo_url?: string | null;
  start_captured_at?: string | null;
  end_photo_url?: string | null;
  end_captured_at?: string | null;
  logged_at: string;
}

/** Inserts a meeting row. Throws on failure so screens surface the error state. */
export async function createMeeting(record: NewMeetingRecord): Promise<void> {
  const { error } = await supabase.from('meetings').insert({
    ...record,
    selfie_url: record.selfie_url ?? null,
    start_photo_url: record.start_photo_url ?? null,
    start_captured_at: record.start_captured_at ?? null,
    end_photo_url: record.end_photo_url ?? null,
    end_captured_at: record.end_captured_at ?? null,
  });
  if (error) throw error;
}
