export const POI_TYPES = [
  'trail',
  'monument',
  'restaurant',
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
}
