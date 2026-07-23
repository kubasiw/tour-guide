export interface Trail {
  // `id` is the persisted DB row (what `PlanTrailItem.trailId` points to,
  // same "cache POIs first, always deal with the DB id" precedent as
  // `Poi`); `osmId` is the raw OSM relation id, needed separately to call
  // Waymarked Trails' geometry endpoint, which knows nothing about our DB.
  id: string;
  osmId: string;
  name: string;
  ref: string | null;
  colour: string | null;
  distanceKm: number | null;
}

export interface LatLng {
  lat: number;
  lng: number;
}

// Segments, not one flat line — a route's ways aren't always contiguous
// (real gaps exist, e.g. where a trail briefly shares an unmapped path), so
// each inner array is one continuous drawable line.
export interface TrailGeometry {
  id: string;
  name: string;
  segments: LatLng[][];
}
