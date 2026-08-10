import { Platform } from 'react-native';
import { Directory, File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as SecureStore from 'expo-secure-store';
import { buildReportCsv, type ReportExportInput } from './report-csv';

// 2026-08-10: real Excel-compatible export for the Executive Reports screen
// (`app/(executive)/more/reports.tsx`), replacing the former `showToast`
// "Excel download simulated" fake. Emits a UTF-8 **CSV** (opens natively in
// Excel / Google Sheets) rather than a binary .xlsx — no heavy SheetJS
// dependency, just a pure string. The pure CSV assembly lives in
// lib/report-csv.ts so it stays unit-testable without pulling in these native
// modules; this file is the thin file-write + save/share wrapper only.
//
// Two "download" surfaces (user picked "save + offer share", 2026-08-10):
//   - `saveReportCsv()`  — Android direct-save to a user-picked folder (SAF),
//                          remembered across saves so it's silent after the
//                          first grant. iOS has no shared Downloads folder, so
//                          it reports unsupported and the screen shares instead.
//   - `exportReportCsv()`— always opens the native share sheet (Files/Drive/
//                          email/…), the cross-platform fallback + the "Share"
//                          affordance.

export type { ReportExportInput, ReportExportRow } from './report-csv';

/** UTF-8 byte-order mark — prepended so Excel opens the CSV as UTF-8 instead of guessing the locale codepage and mangling accented names. */
const UTF8_BOM = String.fromCharCode(0xfeff);

/** SecureStore key holding the SAF content:// URI of the folder the user last chose to save reports into. */
const SAVE_DIR_KEY = 'oracle_report_save_directory_uri';

/** Slugifies a base name so the on-disk filename is safe (letters/digits/dash/underscore only). */
function safeFileBase(base: string): string {
  const cleaned = base.replace(/[^a-zA-Z0-9-_]+/g, '-').replace(/^-+|-+$/g, '');
  return cleaned || 'report';
}

function writeCsvInto(dir: Directory, input: ReportExportInput, fileBaseName: string): string {
  const file = dir.createFile(`${safeFileBase(fileBaseName)}.csv`, 'text/csv');
  file.write(UTF8_BOM + buildReportCsv(input));
  return dir.name;
}

/** Reconstructs the remembered save directory from SecureStore, or `null` if none is stored / the read fails. */
async function getRememberedDirectory(): Promise<Directory | null> {
  try {
    const uri = await SecureStore.getItemAsync(SAVE_DIR_KEY);
    return uri ? new Directory(uri) : null;
  } catch {
    return null;
  }
}

export type SaveReportResult =
  | { status: 'saved'; folderName: string }
  | { status: 'cancelled' }
  | { status: 'unsupported' };

/**
 * Android: writes the CSV directly into a folder the user picks once (Storage
 * Access Framework), then remembers that folder so later saves are silent. If
 * the remembered folder is gone or its permission was revoked, the write is
 * retried by re-prompting. Returns `'cancelled'` if the user dismisses the
 * folder picker, and `'unsupported'` on non-Android (no shared Downloads
 * location — the caller should fall back to `exportReportCsv`).
 */
export async function saveReportCsv(input: ReportExportInput, fileBaseName: string): Promise<SaveReportResult> {
  if (Platform.OS !== 'android') return { status: 'unsupported' };

  // Try the remembered folder first for a silent re-save.
  const remembered = await getRememberedDirectory();
  if (remembered) {
    try {
      return { status: 'saved', folderName: writeCsvInto(remembered, input, fileBaseName) };
    } catch {
      // Folder deleted or permission revoked — forget it and fall through to re-prompt.
      await SecureStore.deleteItemAsync(SAVE_DIR_KEY).catch(() => {});
    }
  }

  let dir: Directory;
  try {
    dir = await Directory.pickDirectoryAsync();
  } catch (err) {
    // The picker rejects on user cancel; treat that as a silent no-op rather than an error.
    const msg = err instanceof Error ? err.message.toLowerCase() : '';
    if (msg.includes('cancel')) return { status: 'cancelled' };
    throw err;
  }

  await SecureStore.setItemAsync(SAVE_DIR_KEY, dir.uri).catch(() => {});
  return { status: 'saved', folderName: writeCsvInto(dir, input, fileBaseName) };
}

/**
 * Writes the CSV to the cache dir and opens the native share sheet (the mobile
 * equivalent of a "download" — the user picks Drive / Files / email / etc).
 * Throws when sharing is unavailable so the caller can surface a real error
 * instead of a silent no-op.
 */
export async function exportReportCsv(input: ReportExportInput, fileBaseName: string): Promise<void> {
  if (!(await Sharing.isAvailableAsync())) {
    throw new Error('Sharing is not available on this device.');
  }
  const file = new File(Paths.cache, `${safeFileBase(fileBaseName)}.csv`);
  file.create({ overwrite: true, intermediates: true });
  file.write(UTF8_BOM + buildReportCsv(input));
  await Sharing.shareAsync(file.uri, {
    mimeType: 'text/csv',
    dialogTitle: 'Export report',
    UTI: 'public.comma-separated-values-text',
  });
}
