export type PoiType =
  | 'trail'
  | 'monument'
  | 'restaurant'
  | 'nightlife'
  | 'shelter'
  | 'accommodation';

export interface Poi {
  id: string;
  osmId: string;
  name: string;
  type: PoiType;
  lat: number;
  lng: number;
  openingHours: string | null;
}

export const POI_TYPE_ICONS: Record<PoiType, string> = {
  trail: 'bi-signpost-2',
  monument: 'bi-bank',
  restaurant: 'bi-cup-hot',
  nightlife: 'bi-moon-stars',
  shelter: 'bi-house-door',
  accommodation: 'bi-building',
};

export const POI_TYPE_COLORS: Record<PoiType, string> = {
  trail: 'bg-success-subtle',
  monument: 'bg-warning-subtle',
  restaurant: 'bg-danger-subtle',
  nightlife: 'bg-info-subtle',
  shelter: 'bg-secondary-subtle',
  accommodation: 'bg-primary-subtle',
};
