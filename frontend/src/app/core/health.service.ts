import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL } from './api-base-url';

export interface HealthStatus {
  status: string;
}

@Injectable({ providedIn: 'root' })
export class HealthService {
  private readonly http = inject(HttpClient);

  public check(): Observable<HealthStatus> {
    return this.http.get<HealthStatus>(`${API_BASE_URL}/health`);
  }
}
