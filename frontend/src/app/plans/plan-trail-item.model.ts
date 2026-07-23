import { Trail } from '../core/trail.model';

// Deliberately its own shape, not reusing `PlanItemWithPoi` — trails have
// their own small list ("Twoje szlaki"), separate from "Twój plan", not
// interleaved/drag-reordered with POI items.
export interface PlanTrailItem {
  id: string;
  order: number;
  trail: Trail;
}
