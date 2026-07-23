import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL } from './api-base-url';

@Injectable({ providedIn: 'root' })
export class PoiService {
  private readonly http = inject(HttpClient);

  public getDescription(poiId: string): Observable<{ description: string }> {
    return this.http.get<{ description: string }>(`${API_BASE_URL}/pois/${poiId}/description`);
  }
}
