import { Component, computed, effect, inject, input, signal } from '@angular/core';
import { httpResource } from '@angular/common/http';
import { Router } from '@angular/router';
import { NgbAlert } from '@ng-bootstrap/ng-bootstrap';
import { API_BASE_URL } from '../core/api-base-url';
import { ACTIVITIES } from '../core/activity.model';
import { extractErrorMessage } from '../core/http-error';
import { Plan } from '../plans/plan.model';
import { buildPlanSteps } from '../plans/plan-steps';
import { PlanService } from '../plans/plan.service';
import { Loader } from '../shared/loader/loader';
import { Stepper } from '../shared/stepper/stepper';

@Component({
  selector: 'app-activity-selector',
  imports: [Loader, NgbAlert, Stepper],
  templateUrl: './activity-selector.html',
})
export class ActivitySelector {
  public readonly id = input.required<string>();

  private readonly planService = inject(PlanService);
  private readonly router = inject(Router);

  protected readonly plan = httpResource<Plan>(() => `${API_BASE_URL}/plans/${this.id()}`);

  protected readonly steps = computed(() => buildPlanSteps(this.plan.value(), this.id(), 'activities'));

  protected readonly activities = ACTIVITIES;
  protected readonly selected = signal<ReadonlySet<string>>(new Set());
  protected readonly submitting = signal(false);
  protected readonly errorMessage = signal<string | null>(null);

  public constructor() {
    effect(() => {
      const plan = this.plan.value();
      if (plan) {
        this.selected.set(new Set(plan.activities));
      }
    });
  }

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
