export interface LatLng {
  lat: number;
  lng: number;
}

export type Area =
  | { kind: 'polygon'; points: LatLng[] }
  | { kind: 'radius'; center: LatLng; radiusMeters: number };
