export type PoiType =
  'trail' | 'monument' | 'restaurant' | 'nightlife' | 'shelter' | 'accommodation';

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

// Real color values for Leaflet markers (can't consume Bootstrap utility
// classes) — Bootstrap's own stock semantic hex values, matching the
// bg-*-subtle families above; accommodation uses this app's customized
// $primary instead of Bootstrap's stock blue.
export const POI_TYPE_MARKER_COLORS: Record<PoiType, string> = {
  trail: '#198754',
  monument: '#ffc107',
  restaurant: '#dc3545',
  nightlife: '#0dcaf0',
  shelter: '#6c757d',
  accommodation: '#2f6b4f',
};
