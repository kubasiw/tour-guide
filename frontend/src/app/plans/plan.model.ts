import { Area } from '../core/area.model';

export interface Plan {
  id: string;
  status: string;
  area: Area;
  activities: string[];
  startDate: string | null;
  durationDays: number | null;
  createdAt: string;
}
