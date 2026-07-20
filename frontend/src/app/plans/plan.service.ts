import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../core/api-base-url';
import { Area } from '../core/area.model';
import { Poi } from '../core/poi.model';
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

  public updateArea(id: string, area: Area): Observable<Plan> {
    return this.http.patch<Plan>(`${API_BASE_URL}/plans/${id}/area`, area);
  }

  public getCandidates(id: string): Observable<Poi[]> {
    return this.http.get<Poi[]>(`${API_BASE_URL}/plans/${id}/candidates`);
  }

  public getItems(id: string): Observable<PlanItemWithPoi[]> {
    return this.http.get<PlanItemWithPoi[]>(`${API_BASE_URL}/plans/${id}/items`);
  }

  public addItem(planId: string, poiId: string): Observable<PlanItemWithPoi> {
    return this.http.post<PlanItemWithPoi>(`${API_BASE_URL}/plans/${planId}/items`, { poiId });
  }

  public removeItem(planId: string, itemId: string): Observable<void> {
    return this.http.delete<void>(`${API_BASE_URL}/plans/${planId}/items/${itemId}`);
  }
}
