import { createClient } from 'supabase';

const HEADERS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, apikey, content-type' };
const PH_BOUNDS = { minLat: 4.5, maxLat: 21.5, minLng: 116, maxLng: 127.5 };
const NOMINATIM_TIMEOUT_MS = 10_000;

type RequestBody = { action?: unknown; query?: unknown; lat?: unknown; lng?: unknown };
type NominatimRow = { place_id?: number; display_name?: string; lat?: string; lon?: string; address?: { country_code?: string } };

function json(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...HEADERS, 'Content-Type': 'application/json' } });
}
function inBounds(lat: number, lng: number): boolean {
  return Number.isFinite(lat) && Number.isFinite(lng) && lat >= PH_BOUNDS.minLat && lat <= PH_BOUNDS.maxLat && lng >= PH_BOUNDS.minLng && lng <= PH_BOUNDS.maxLng;
}
function parseBody(value: unknown): RequestBody | null {
  return value && typeof value === 'object' ? value as RequestBody : null;
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: HEADERS });
  if (request.method !== 'POST') return json({ error: 'Method not allowed.' }, 405);
  const authorization = request.headers.get('Authorization');
  if (!authorization) return json({ error: 'Sign-in required.' }, 401);
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const providerUserAgent = Deno.env.get('NOMINATIM_USER_AGENT');
  if (!supabaseUrl || !serviceRoleKey || !providerUserAgent) return json({ error: 'Geocoder is not configured.' }, 500);
  const admin = createClient(supabaseUrl, serviceRoleKey);
  const token = authorization.replace(/^Bearer\s+/i, '');
  const { data: user, error: authError } = await admin.auth.getUser(token);
  if (authError || !user.user) return json({ error: 'Invalid session.' }, 401);
  const body = parseBody(await request.json().catch(() => null));
  if (!body || (body.action !== 'search' && body.action !== 'reverse')) return json({ error: 'Invalid geocode action.' }, 400);
  let cacheKey: string;
  let endpoint: string;
  if (body.action === 'search') {
    if (typeof body.query !== 'string' || body.query.trim().length < 3 || body.query.length > 120) return json({ error: 'Invalid Philippines place query.' }, 400);
    cacheKey = `search:${body.query.trim().toLocaleLowerCase()}`;
    endpoint = `https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&countrycodes=ph&limit=8&q=${encodeURIComponent(body.query.trim())}`;
  } else {
    const lat = typeof body.lat === 'number' ? body.lat : Number(body.lat);
    const lng = typeof body.lng === 'number' ? body.lng : Number(body.lng);
    if (!inBounds(lat, lng)) return json({ error: 'Office pin must be within the Philippines.' }, 400);
    cacheKey = `reverse:${lat.toFixed(5)}:${lng.toFixed(5)}`;
    endpoint = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&addressdetails=1&lat=${lat}&lon=${lng}`;
  }
  const cached = await admin.from('philippines_geocode_cache').select('response').eq('cache_key', cacheKey).gt('expires_at', new Date().toISOString()).maybeSingle();
  if (cached.data?.response) return json(cached.data.response as Record<string, unknown>);
  const { data: allowed, error: slotError } = await admin.rpc('consume_philippines_geocode_slot');
  if (slotError || allowed !== true) return json({ error: 'Place search is busy. Please try again in a moment.' }, 429);
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), NOMINATIM_TIMEOUT_MS);
  let response: Response;
  try {
    response = await fetch(endpoint, { headers: { Accept: 'application/json', 'User-Agent': providerUserAgent }, signal: controller.signal });
  } catch {
    return controller.signal.aborted
      ? json({ error: 'Place search timed out. Please try again.' }, 504)
      : json({ error: 'Geocoder unavailable.' }, 502);
  } finally {
    clearTimeout(timeoutId);
  }
  if (!response.ok) return json({ error: 'Geocoder unavailable.' }, 502);
  const raw = await response.json() as NominatimRow | NominatimRow[];
  const result = body.action === 'search'
    ? { results: (raw as NominatimRow[]).filter((row) => row.address?.country_code?.toLowerCase() === 'ph').map((row) => ({ id: String(row.place_id ?? row.display_name), name: (row.display_name ?? '').split(',')[0] ?? '', address: row.display_name ?? '', lat: Number(row.lat), lng: Number(row.lon) })).filter((row) => inBounds(row.lat, row.lng)) }
    : { address: (raw as NominatimRow).display_name ?? '', countryCode: (raw as NominatimRow).address?.country_code?.toLowerCase() ?? '' };
  await admin.from('philippines_geocode_cache').upsert({ cache_key: cacheKey, response: result, expires_at: new Date(Date.now() + 86_400_000).toISOString() });
  return json(result);
});
