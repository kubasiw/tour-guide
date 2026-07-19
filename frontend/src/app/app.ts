import { Component, inject, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { HealthService } from './core/health.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App {
  protected readonly title = signal('Tourist App');
  protected readonly backendStatus = signal<'checking' | 'ok' | 'error'>('checking');

  private readonly healthService = inject(HealthService);

  constructor() {
    this.healthService.check().subscribe({
      next: () => this.backendStatus.set('ok'),
      error: () => this.backendStatus.set('error')
    });
  }
}
