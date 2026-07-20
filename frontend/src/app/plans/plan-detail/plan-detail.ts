import { Component, computed, input } from '@angular/core';
import { DatePipe } from '@angular/common';
import { httpResource } from '@angular/common/http';
import { API_BASE_URL } from '../../core/api-base-url';
import { activityLabel } from '../../core/activity.model';
import { areaCenter } from '../../core/area.model';
import { Plan } from '../plan.model';
import { Loader } from '../../shared/loader/loader';
import { AreaSummary } from '../../shared/area-summary/area-summary';
import { WeatherForecast } from '../../weather/weather-forecast/weather-forecast';

@Component({
  selector: 'app-plan-detail',
  imports: [Loader, AreaSummary, WeatherForecast, DatePipe],
  templateUrl: './plan-detail.html',
})
export class PlanDetail {
  public readonly id = input.required<string>();

  protected readonly plan = httpResource<Plan>(() => `${API_BASE_URL}/plans/${this.id()}`);

  protected readonly center = computed(() => {
    const plan = this.plan.value();
    return plan ? areaCenter(plan.area) : null;
  });

  protected label(key: string): string {
    return activityLabel(key);
  }
}
