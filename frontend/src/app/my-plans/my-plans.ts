import { Component, inject } from '@angular/core';
import { DatePipe } from '@angular/common';
import { rxResource } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { NgbAlert } from '@ng-bootstrap/ng-bootstrap';
import { activityLabel } from '../core/activity.model';
import { Loader } from '../shared/loader/loader';
import { PLAN_STATUS_FINAL } from '../plans/plan-status';
import { PlanService } from '../plans/plan.service';

@Component({
  selector: 'app-my-plans',
  imports: [Loader, NgbAlert, DatePipe, RouterLink],
  templateUrl: './my-plans.html',
})
export class MyPlans {
  private readonly planService = inject(PlanService);

  protected readonly planStatusFinal = PLAN_STATUS_FINAL;

  protected readonly plans = rxResource({
    stream: () => this.planService.listMine(),
  });

  protected label(key: string): string {
    return activityLabel(key);
  }
}
