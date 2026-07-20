import { Component, inject, input, signal } from '@angular/core';
import { Router } from '@angular/router';
import { NgbAlert } from '@ng-bootstrap/ng-bootstrap';
import { ACTIVITIES } from '../core/activity.model';
import { extractErrorMessage } from '../core/http-error';
import { PlanService } from '../plans/plan.service';
import { Loader } from '../shared/loader/loader';

@Component({
  selector: 'app-activity-selector',
  imports: [Loader, NgbAlert],
  templateUrl: './activity-selector.html',
})
export class ActivitySelector {
  public readonly id = input.required<string>();

  private readonly planService = inject(PlanService);
  private readonly router = inject(Router);

  protected readonly activities = ACTIVITIES;
  protected readonly selected = signal<ReadonlySet<string>>(new Set());
  protected readonly submitting = signal(false);
  protected readonly errorMessage = signal<string | null>(null);

  protected toggle(key: string): void {
    const next = new Set(this.selected());
    if (next.has(key)) {
      next.delete(key);
    } else {
      next.add(key);
    }
    this.selected.set(next);
  }

  protected submit(): void {
    if (this.selected().size === 0) {
      return;
    }

    this.submitting.set(true);
    this.errorMessage.set(null);

    this.planService.update(this.id(), { activities: [...this.selected()] }).subscribe({
      next: (plan) => {
        void this.router.navigate(['/plans', plan.id, 'trip-details']);
      },
      error: (err: unknown) => {
        this.submitting.set(false);
        this.errorMessage.set(extractErrorMessage(err));
      },
    });
  }
}
