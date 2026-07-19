import { Component, inject, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { RouterLink, RouterOutlet } from '@angular/router';
import { NgbAlert } from '@ng-bootstrap/ng-bootstrap';
import { AuthService } from './auth/auth.service';
import { HealthService } from './core/health.service';
import { Loader } from './shared/loader/loader';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, Loader, NgbAlert],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App {
  protected readonly title = signal('Tourist App');

  protected readonly authService = inject(AuthService);

  private readonly healthService = inject(HealthService);

  protected readonly health = rxResource({
    stream: () => this.healthService.check(),
  });
}
