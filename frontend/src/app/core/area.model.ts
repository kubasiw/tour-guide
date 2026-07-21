export interface LatLng {
  lat: number;
  lng: number;
}

export type Area =
  { kind: 'polygon'; points: LatLng[] } | { kind: 'radius'; center: LatLng; radiusMeters: number };

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
  return { lat: total.lat / area.points.length, lng: total.lng / area.points.length };
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
    area.radiusMeters / (METERS_PER_DEGREE_LAT * Math.cos((area.center.lat * Math.PI) / 180));

  return {
    south: area.center.lat - latDelta,
    north: area.center.lat + latDelta,
    west: area.center.lng - lngDelta,
    east: area.center.lng + lngDelta,
  };
}

// Nominatim's reverse-geocoding `zoom` (0-18) controls how precise the returned
// place is (18 = building, 10 = city, 3 = country) — picked from the drawn
// area's real size so a big circle resolves to a city name, not the specific
// street its center happens to land on. Thresholds are deliberate, tunable
// choices, not rigorously derived. Mirrors the backend version
// (`backend/src/plans/area.type.ts`).
export function estimateReverseZoom(area: Area): number {
  const bbox = areaBoundingBox(area);
  const centerLatRad = ((bbox.north + bbox.south) / 2 / 180) * Math.PI;

  const latMeters = (bbox.north - bbox.south) * METERS_PER_DEGREE_LAT;
  const lngMeters = (bbox.east - bbox.west) * METERS_PER_DEGREE_LAT * Math.cos(centerLatRad);
  const diagonalMeters = Math.sqrt(latMeters ** 2 + lngMeters ** 2);

  if (diagonalMeters <= 1000) {
    return 17;
  }
  if (diagonalMeters <= 3000) {
    return 15;
  }
  if (diagonalMeters <= 8000) {
    return 13;
  }
  if (diagonalMeters <= 20000) {
    return 11;
  }
  if (diagonalMeters <= 60000) {
    return 9;
  }
  return 7;
}
