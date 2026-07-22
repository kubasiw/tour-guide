import {
  Component,
  ElementRef,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { NgbAlert } from '@ng-bootstrap/ng-bootstrap';
import { extractErrorMessage } from '../../core/http-error';
import { Loader } from '../../shared/loader/loader';
import { ChatTurn, PlanChatService } from '../plan-chat.service';

interface ChatMessage {
  role: 'user' | 'assistant';
  text: string;
}

@Component({
  selector: 'app-plan-chat',
  imports: [Loader, NgbAlert],
  templateUrl: './plan-chat.html',
  styleUrl: './plan-chat.scss',
})
export class PlanChat {
  public readonly planId = input.required<string>();
  public readonly itemsChanged = output<void>();

  private readonly planChatService = inject(PlanChatService);
  private readonly chatInput = viewChild<ElementRef<HTMLInputElement>>('chatInput');

  protected readonly messages = signal<ChatMessage[]>([]);
  protected readonly sending = signal(false);
  protected readonly error = signal<string | null>(null);

  private history: ChatTurn[] = [];

  protected send(): void {
    const inputEl = this.chatInput()?.nativeElement;
    const text = inputEl?.value.trim();
    if (!text || this.sending()) {
      return;
    }

    this.messages.update((messages) => [...messages, { role: 'user', text }]);
    if (inputEl) {
      inputEl.value = '';
    }
    this.sending.set(true);
    this.error.set(null);

    this.planChatService.sendMessage(this.planId(), text, this.history).subscribe({
      next: ({ reply, history }) => {
        this.sending.set(false);
        this.history = history;
        this.messages.update((messages) => [...messages, { role: 'assistant', text: reply }]);
        this.itemsChanged.emit();
      },
      error: (err: unknown) => {
        this.sending.set(false);
        this.error.set(extractErrorMessage(err));
      },
    });
  }
}
