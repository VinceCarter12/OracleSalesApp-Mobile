import { File, Paths } from 'expo-file-system';
import { supabase } from './supabase';
import type { ReportTimeframe } from './report-timeframe';
import type { ManagerReportExportCategory } from './manager-report-filter';

export interface ManagerReportExportRequest {
  timeframe: ReportTimeframe;
  agentIds: string[];
  categories: ManagerReportExportCategory[];
  searchQuery: string;
}

const EXCEL_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const BASE64_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

/**
 * A development build created before `expo-sharing` was added cannot resolve
 * ExpoSharing. Keep that native import off the route-import path so Expo
 * Router can still render Reports and show a truthful rebuild message only
 * if the user actually tries to export.
 */
function sharingModule(): typeof import('expo-sharing') {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- must not crash route import on a pre-sharing dev build.
    return require('expo-sharing') as typeof import('expo-sharing');
  } catch {
    throw new Error('The app needs to be rebuilt before Excel export can be used.');
  }
}

/** Converts an Edge Function's binary workbook response without relying on
 * browser-only Blob helpers or a Hermes global. */
export function bytesToBase64(bytes: Uint8Array): string {
  let result = '';
  for (let index = 0; index < bytes.length; index += 3) {
    const first = bytes[index];
    const second = bytes[index + 1];
    const third = bytes[index + 2];
    result += BASE64_CHARS[first >> 2];
    result += BASE64_CHARS[((first & 3) << 4) | (second === undefined ? 0 : second >> 4)];
    result += second === undefined ? '=' : BASE64_CHARS[((second & 15) << 2) | (third === undefined ? 0 : third >> 6)];
    result += third === undefined ? '=' : BASE64_CHARS[third & 63];
  }
  return result;
}

function reportFileName(): string {
  const date = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date());
  return `team-report-${date}.xlsx`;
}

/**
 * Generates the workbook inside the authenticated Edge Function, then saves
 * it to the app cache and opens Android's native share sheet. The mobile
 * payload is merely a requested scope: the function re-derives the manager's
 * team from the authenticated user before querying any records.
 */
export async function exportManagerReport(request: ManagerReportExportRequest): Promise<void> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('You need to be signed in to export.');

  const response = await fetch(`${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/manager-report-export`, {
    method: 'POST',
    headers: {
      apikey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '',
      Authorization: `Bearer ${session.access_token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  });
  if (!response.ok) {
    let message = "The Excel report couldn't be generated. Try again.";
    try {
      const body = await response.json() as { error?: string };
      if (body.error) message = body.error;
    } catch {
      // Keep the safe, user-facing fallback when a proxy returns non-JSON.
    }
    throw new Error(message);
  }

  const workbook = new Uint8Array(await response.arrayBuffer());
  const file = new File(Paths.cache, reportFileName());
  if (file.exists) file.delete();
  file.create({ intermediates: true, overwrite: true });
  file.write(workbook);

  const Sharing = sharingModule();
  if (!await Sharing.isAvailableAsync()) {
    throw new Error('File sharing isn\'t available on this device.');
  }
  await Sharing.shareAsync(file.uri, { mimeType: EXCEL_MIME, dialogTitle: 'Share the team report' });
}
