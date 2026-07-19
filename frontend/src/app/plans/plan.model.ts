import { Area } from '../core/area.model';

export interface Plan {
  id: string;
  status: string;
  area: Area;
  createdAt: string;
}
