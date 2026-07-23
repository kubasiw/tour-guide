import { Poi } from '../poi/poi.types';
import { Trail } from '../trails/trails.types';

export interface PlanItemWithPoi {
  id: string;
  order: number;
  dayNumber: number | null;
  note: string | null;
  userModified: boolean;
  poi: Poi;
}

// Deliberately its own shape, not reusing `PlanItemWithPoi` with a swapped
// field — trails don't have `dayNumber`/`note`/`userModified` (a separate,
// simpler list, not interleaved with POI plan items; see the Trail/
// PlanTrailItem Prisma models' own comment for why).
export interface PlanTrailItem {
  id: string;
  order: number;
  trail: Trail;
}
