import { Poi } from '../poi/poi.types';

export interface PlanItemWithPoi {
  id: string;
  order: number;
  dayNumber: number | null;
  note: string | null;
  userModified: boolean;
  poi: Poi;
}
