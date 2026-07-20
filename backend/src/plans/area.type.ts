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

const METERS_PER_DEGREE_LAT = 111320;

export function areaCenter(area: Area): LatLng {
  if (area.kind === 'radius') {
    return area.center;
  }

  const total = area.points.reduce(
    (sum, point) => ({ lat: sum.lat + point.lat, lng: sum.lng + point.lng }),
    { lat: 0, lng: 0 },
  );
  return {
    lat: total.lat / area.points.length,
    lng: total.lng / area.points.length,
  };
}

export function areaBoundingBox(area: Area): BoundingBox {
  if (area.kind === 'polygon') {
    const lats = area.points.map((point) => point.lat);
    const lngs = area.points.map((point) => point.lng);
    return {
      south: Math.min(...lats),
      north: Math.max(...lats),
      west: Math.min(...lngs),
      east: Math.max(...lngs),
    };
  }

  const latDelta = area.radiusMeters / METERS_PER_DEGREE_LAT;
  const lngDelta =
    area.radiusMeters /
    (METERS_PER_DEGREE_LAT * Math.cos((area.center.lat * Math.PI) / 180));

  return {
    south: area.center.lat - latDelta,
    north: area.center.lat + latDelta,
    west: area.center.lng - lngDelta,
    east: area.center.lng + lngDelta,
  };
}
