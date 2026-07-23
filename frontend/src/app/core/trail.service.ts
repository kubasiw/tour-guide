import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL } from './api-base-url';
import { BoundingBox } from './area.model';
import { Trail, TrailGeometry } from './trail.model';

@Injectable({ providedIn: 'root' })
export class TrailService {
  private readonly http = inject(HttpClient);

  public findInBoundingBox(bbox: BoundingBox): Observable<Trail[]> {
    return this.http.get<Trail[]>(`${API_BASE_URL}/trails`, { params: { ...bbox } });
  }

  public getGeometry(id: string): Observable<TrailGeometry> {
    return this.http.get<TrailGeometry>(`${API_BASE_URL}/trails/${id}/geometry`);
  }
}
