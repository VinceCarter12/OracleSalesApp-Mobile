import { isLikelyOnline } from './sync/connectivity';
import { supabase } from './supabase';
export { isPhilippinesCoordinate } from './policies/philippines-coordinate-policy';
import { isPhilippinesCoordinate } from './policies/philippines-coordinate-policy';

export interface PhilippinesPlaceResult {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
}

const FUNCTION_NAME = 'philippines-geocode';

/** A deliberately narrow service boundary: replace this with our protected
 * Places/Edge Function when that backend contract is available. */
export async function searchPhilippinesPlaces(query: string): Promise<PhilippinesPlaceResult[]> {
  const trimmed = query.trim();
  if (trimmed.length < 3) return [];
  if (!(await isLikelyOnline())) throw new Error('Place search needs an internet connection. You can still use Current GPS or drag the pin.');

  const { data, error } = await supabase.functions.invoke(FUNCTION_NAME, { body: { action: 'search', query: trimmed } });
  if (error) throw new Error('Could not search places right now. Please try again.');
  const payload = data as { results?: Array<{ id: string; name: string; address: string; lat: number; lng: number }> } | null;
  return (payload?.results ?? []).filter((row) => Number.isFinite(row.lat) && Number.isFinite(row.lng) && isPhilippinesCoordinate(row.lat, row.lng));
}

/** Reverse-geocodes GPS/manual-map coordinates before they become an office
 * candidate. A bounding box is only an early rejection; the returned country
 * code is the authoritative PH guard. */
export async function validatePhilippinesCoordinate(lat: number, lng: number): Promise<string> {
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || !isPhilippinesCoordinate(lat, lng)) {
    throw new Error('Office pin must be within the Philippines.');
  }
  if (!(await isLikelyOnline())) {
    throw new Error('Verify this pin while online before saving it. You can still save a location that was already verified.');
  }
  const { data, error } = await supabase.functions.invoke(FUNCTION_NAME, { body: { action: 'reverse', lat, lng } });
  if (error) throw new Error('Could not verify this pin right now. Please try again.');
  const result = data as { address?: string; countryCode?: string } | null;
  if (result?.countryCode !== 'ph' || typeof result.address !== 'string') {
    throw new Error('Office pin must be within the Philippines.');
  }
  return result.address;
}
