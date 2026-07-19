import { Component, inject, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { RouterOutlet } from '@angular/router';
import { HealthService } from './core/health.service';
import { Loader } from './shared/loader/loader';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, Loader],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App {
  protected readonly title = signal('Tourist App');

  private readonly healthService = inject(HealthService);

  protected readonly health = rxResource({
    stream: () => this.healthService.check(),
  });
}
