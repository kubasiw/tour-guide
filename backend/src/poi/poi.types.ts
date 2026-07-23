export const POI_TYPES = [
  'trail',
  'monument',
  'restaurant',
  'nightlife',
  'shelter',
  'accommodation',
] as const;

export type PoiType = (typeof POI_TYPES)[number];

export interface Poi {
  id: string;
  osmId: string;
  name: string;
  type: PoiType;
  lat: number;
  lng: number;
  openingHours: string | null;
  aiDescription: string | null;
  address: string | null;
}

// Derived from the raw OSM tags already stored in `Poi.sourceData` — no new
// column needed. Real-data check (2026-07-22): ~34% of cached POIs have both
// `addr:street` and `addr:housenumber` (1263/3752) — sparse but common enough
// to be worth surfacing, unlike the `description`/`note`/`wikipedia` tags
// checked earlier for the AI-description feature (2.6%/3.7%, too sparse to
// ship on their own).
export function extractAddress(sourceData: unknown): string | null {
  const tags = sourceData as Record<string, string> | null | undefined;
  const street = tags?.['addr:street'];
  if (!street) {
    return null;
  }

  const housenumber = tags['addr:housenumber'];
  return housenumber ? `${street} ${housenumber}` : street;
}
