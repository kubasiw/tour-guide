import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../core/api-base-url';
import { Area } from '../core/area.model';
import { AreaTheme } from '../core/area-theme.model';
import { Poi } from '../core/poi.model';
import { Trail } from '../core/trail.model';
import { Plan } from './plan.model';
import { PlanItemWithPoi } from './plan-item.model';
import { PlanTrailItem } from './plan-trail-item.model';

export interface UpdatePlanPayload {
  activities?: string[];
  startDate?: string;
  durationDays?: number;
}

@Injectable({ providedIn: 'root' })
export class PlanService {
  private readonly http = inject(HttpClient);

  public create(area: Area, extra?: UpdatePlanPayload): Observable<Plan> {
    return this.http.post<Plan>(`${API_BASE_URL}/plans`, { area, ...extra });
  }

  public listMine(): Observable<Plan[]> {
    return this.http.get<Plan[]>(`${API_BASE_URL}/plans/mine`);
  }

  public update(id: string, patch: UpdatePlanPayload): Observable<Plan> {
    return this.http.patch<Plan>(`${API_BASE_URL}/plans/${id}`, patch);
  }

  public updateArea(id: string, area: Area): Observable<Plan> {
    return this.http.patch<Plan>(`${API_BASE_URL}/plans/${id}/area`, area);
  }

  public finalize(id: string): Observable<Plan> {
    return this.http.patch<Plan>(`${API_BASE_URL}/plans/${id}/finalize`, {});
  }

  public getAiDescription(
    id: string,
  ): Observable<{ description: string; theme: AreaTheme }> {
    return this.http.get<{ description: string; theme: AreaTheme }>(
      `${API_BASE_URL}/plans/${id}/ai-description`,
    );
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

  public reorderItems(planId: string, itemIds: string[]): Observable<PlanItemWithPoi[]> {
    return this.http.patch<PlanItemWithPoi[]>(`${API_BASE_URL}/plans/${planId}/items/reorder`, {
      itemIds,
    });
  }

  public generateNarration(planId: string): Observable<{ narration: string }> {
    return this.http.post<{ narration: string }>(
      `${API_BASE_URL}/plans/${planId}/narration`,
      {},
    );
  }

  public getTrailCandidates(planId: string): Observable<Trail[]> {
    return this.http.get<Trail[]>(`${API_BASE_URL}/plans/${planId}/trail-candidates`);
  }

  public getTrailItems(planId: string): Observable<PlanTrailItem[]> {
    return this.http.get<PlanTrailItem[]>(`${API_BASE_URL}/plans/${planId}/trail-items`);
  }

  public addTrailItem(planId: string, trailId: string): Observable<PlanTrailItem> {
    return this.http.post<PlanTrailItem>(`${API_BASE_URL}/plans/${planId}/trail-items`, {
      trailId,
    });
  }

  public removeTrailItem(planId: string, itemId: string): Observable<void> {
    return this.http.delete<void>(`${API_BASE_URL}/plans/${planId}/trail-items/${itemId}`);
  }
}
