import { BoundingBox } from '../plans/area.type';

export interface GeocodeSearchResult {
  displayName: string;
  lat: number;
  lng: number;
  boundingBox: BoundingBox | null;
}

export interface GeocodeReverseResult {
  displayName: string;
}
