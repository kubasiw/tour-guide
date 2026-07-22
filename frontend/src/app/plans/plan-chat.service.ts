import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../core/api-base-url';

export type ChatTurn = unknown;

export interface SendChatMessageResponse {
  reply: string;
  history: ChatTurn[];
}

@Injectable({ providedIn: 'root' })
export class PlanChatService {
  private readonly http = inject(HttpClient);

  public sendMessage(
    planId: string,
    message: string,
    history: ChatTurn[],
  ): Observable<SendChatMessageResponse> {
    return this.http.post<SendChatMessageResponse>(`${API_BASE_URL}/plans/${planId}/chat`, {
      message,
      history,
    });
  }
}
