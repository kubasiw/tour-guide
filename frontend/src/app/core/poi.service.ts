import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL } from './api-base-url';
import { BoundingBox } from './area.model';
import { Poi } from './poi.model';

@Injectable({ providedIn: 'root' })
export class PoiService {
  private readonly http = inject(HttpClient);

  public findInBoundingBox(bbox: BoundingBox): Observable<Poi[]> {
    return this.http.get<Poi[]>(`${API_BASE_URL}/pois`, { params: { ...bbox } });
  }

  public getDescription(poiId: string): Observable<{ description: string }> {
    return this.http.get<{ description: string }>(`${API_BASE_URL}/pois/${poiId}/description`);
  }
}
