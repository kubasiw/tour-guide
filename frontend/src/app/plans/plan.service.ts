import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../core/api-base-url';
import { Area } from '../core/area.model';
import { Plan } from './plan.model';
import { PlanItemWithPoi } from './plan-item.model';

export interface UpdatePlanPayload {
  activities?: string[];
  startDate?: string;
  durationDays?: number;
}

@Injectable({ providedIn: 'root' })
export class PlanService {
  private readonly http = inject(HttpClient);

  public create(area: Area): Observable<Plan> {
    return this.http.post<Plan>(`${API_BASE_URL}/plans`, { area });
  }

  public update(id: string, patch: UpdatePlanPayload): Observable<Plan> {
    return this.http.patch<Plan>(`${API_BASE_URL}/plans/${id}`, patch);
  }

  public generate(id: string): Observable<PlanItemWithPoi[]> {
    return this.http.post<PlanItemWithPoi[]>(`${API_BASE_URL}/plans/${id}/generate`, {});
  }

  public getItems(id: string): Observable<PlanItemWithPoi[]> {
    return this.http.get<PlanItemWithPoi[]>(`${API_BASE_URL}/plans/${id}/items`);
  }
}
