import { HttpClient } from '@angular/common/http';
import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { Observable, of } from 'rxjs';
import { API_BASE_URL } from '../core/api-base-url';

const TOKEN_KEY = 'tourguide_token';

export interface CurrentUser {
  userId: string;
  email: string;
}

export interface AuthResponse {
  accessToken: string;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly tokenSignal = signal<string | null>(localStorage.getItem(TOKEN_KEY));

  public readonly isAuthenticated = computed(() => this.tokenSignal() !== null);

  public readonly me = rxResource({
    params: () => this.tokenSignal(),
    stream: ({ params: token }) =>
      token ? this.http.get<CurrentUser>(`${API_BASE_URL}/auth/me`) : of(null),
  });

  public constructor() {
    effect(() => {
      if (this.me.error()) {
        this.logout();
      }
    });
  }

  public register(email: string, password: string): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${API_BASE_URL}/auth/register`, { email, password });
  }

  public login(email: string, password: string): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${API_BASE_URL}/auth/login`, { email, password });
  }

  public forgotPassword(email: string): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${API_BASE_URL}/auth/forgot-password`, { email });
  }

  public resetPassword(token: string, newPassword: string): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${API_BASE_URL}/auth/reset-password`, {
      token,
      newPassword,
    });
  }

  public changePassword(
    currentPassword: string,
    newPassword: string,
  ): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${API_BASE_URL}/auth/change-password`, {
      currentPassword,
      newPassword,
    });
  }

  public setToken(token: string): void {
    localStorage.setItem(TOKEN_KEY, token);
    this.tokenSignal.set(token);
  }

  public logout(): void {
    localStorage.removeItem(TOKEN_KEY);
    this.tokenSignal.set(null);
  }

  public token(): string | null {
    return this.tokenSignal();
  }
}
