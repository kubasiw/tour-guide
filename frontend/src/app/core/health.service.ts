import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

export interface HealthStatus {
  status: string;
}

@Injectable({ providedIn: 'root' })
export class HealthService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = 'http://localhost:3000/health';

  public check(): Observable<HealthStatus> {
    return this.http.get<HealthStatus>(this.apiUrl);
  }
}
