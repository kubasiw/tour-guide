export interface Trail {
  // Persisted DB row id — what `PlanTrailItem.trailId` references.
  id: string;
  // Raw OSM relation id — needed separately to call the geometry endpoint,
  // which knows nothing about our DB.
  osmId: string;
  name: string;
  ref: string | null;
  colour: string | null;
  distanceKm: number | null;
}

export interface TrailGeometry {
  id: string;
  name: string;
  segments: { lat: number; lng: number }[][];
}
