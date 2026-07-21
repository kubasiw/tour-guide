import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL } from './api-base-url';
import { BoundingBox } from './area.model';

export interface GeocodeSearchResult {
  displayName: string;
  lat: number;
  lng: number;
  boundingBox: BoundingBox | null;
}

export interface GeocodeReverseResult {
  displayName: string;
}

@Injectable({ providedIn: 'root' })
export class GeocodingService {
  private readonly http = inject(HttpClient);

  public search(query: string): Observable<GeocodeSearchResult[]> {
    return this.http.get<GeocodeSearchResult[]>(`${API_BASE_URL}/geocode/search`, {
      params: { q: query },
    });
  }

  public reverse(lat: number, lng: number, zoom?: number): Observable<GeocodeReverseResult> {
    return this.http.get<GeocodeReverseResult>(`${API_BASE_URL}/geocode/reverse`, {
      params: zoom === undefined ? { lat, lng } : { lat, lng, zoom },
    });
  }
}
