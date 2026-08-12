/** Broad national bounding box. The Places API country filter is the primary
 * protection; this prevents a dragged pin from being saved outside the PH. */
export function isPhilippinesCoordinate(lat: number, lng: number): boolean {
  return lat >= 4 && lat <= 22 && lng >= 116 && lng <= 127;
}
