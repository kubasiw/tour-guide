export interface LatLng {
  lat: number;
  lng: number;
}

export type Area =
  | { kind: 'polygon'; points: LatLng[] }
  | { kind: 'radius'; center: LatLng; radiusMeters: number };

export interface BoundingBox {
  south: number;
  west: number;
  north: number;
  east: number;
}

export function areaCenter(area: Area): LatLng {
  if (area.kind === 'radius') {
    return area.center;
  }

  const total = area.points.reduce(
    (sum, point) => ({ lat: sum.lat + point.lat, lng: sum.lng + point.lng }),
    { lat: 0, lng: 0 },
  );
  return { lat: total.lat / area.points.length, lng: total.lng / area.points.length };
}
