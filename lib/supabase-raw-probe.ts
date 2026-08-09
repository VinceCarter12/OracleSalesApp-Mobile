import { supabase } from './supabase';

// 2026-08-09, PO confirmation RLS investigation (Bugs.md B-098): every
// server-side check (policy text, live data, direct-SQL reproduction with
// the real JWT `sub`) proved correct, and a raw `fetch()` GET using the
// live session's exact access token succeeded (200) at the same moment
// `supabase.from('po_confirmation_requests').insert(...)` was rejected with
// a row-level-security error using that SAME token — isolating the bug to
// supabase-js's own request construction for this call site, not RLS, data,
// or policy. `rawSupabaseRestInsert()` is the current production workaround:
// it bypasses the SDK's `.insert()` builder and posts directly to PostgREST
// with manually-attached headers. Release-build/device verification is still
// required before this transport issue can be considered closed.

interface RawInsertSuccess {
  ok: true;
}
interface RawInsertFailure {
  ok: false;
  status: number;
  code?: string;
  message: string;
}
export type RawInsertResult = RawInsertSuccess | RawInsertFailure;

async function getRestAuthContext(): Promise<
  { accessToken: string; supabaseUrl: string; anonKey: string } | { error: string }
> {
  const { data } = await supabase.auth.getSession();
  const accessToken = data.session?.access_token;
  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  if (!accessToken) return { error: 'no live access_token (session is null)' };
  if (!supabaseUrl) return { error: 'missing EXPO_PUBLIC_SUPABASE_URL' };
  if (!anonKey) return { error: 'missing EXPO_PUBLIC_SUPABASE_ANON_KEY' };
  return { accessToken, supabaseUrl, anonKey };
}

/**
 * Direct PostgREST INSERT, bypassing supabase-js's `.from().insert()` —
 * the verified-working path for `po_confirmation_requests` (see file
 * header). `Prefer: return=minimal` keeps the response body empty on
 * success (matches `.insert()`'s default, no need for the row back).
 */
export async function rawSupabaseRestInsert(table: string, payload: Record<string, unknown>): Promise<RawInsertResult> {
  const ctx = await getRestAuthContext();
  if ('error' in ctx) return { ok: false, status: 0, message: ctx.error };

  const res = await fetch(`${ctx.supabaseUrl}/rest/v1/${table}`, {
    method: 'POST',
    headers: {
      apikey: ctx.anonKey,
      Authorization: `Bearer ${ctx.accessToken}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify(payload),
  });
  if (res.ok) return { ok: true };

  const bodyText = await res.text();
  try {
    const parsed = JSON.parse(bodyText) as { code?: string; message?: string };
    return { ok: false, status: res.status, code: parsed.code, message: parsed.message ?? 'PostgREST request failed' };
  } catch {
    return { ok: false, status: res.status, message: 'PostgREST request failed' };
  }
}
