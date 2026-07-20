import { Poi } from '../core/poi.model';

export interface PlanItemWithPoi {
  id: string;
  order: number;
  dayNumber: number;
  note: string | null;
  userModified: boolean;
  poi: Poi;
}
