import { Poi } from '../poi/poi.types';

export interface PlanItemWithPoi {
  id: string;
  order: number;
  dayNumber: number;
  note: string | null;
  userModified: boolean;
  poi: Poi;
}
