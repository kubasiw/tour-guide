import { Component, computed, input } from '@angular/core';
import { httpResource } from '@angular/common/http';
import { API_BASE_URL } from '../../core/api-base-url';
import { areaCenter } from '../../core/area.model';
import { Plan } from '../plan.model';
import { Loader } from '../../shared/loader/loader';
import { AreaSummary } from '../../shared/area-summary/area-summary';
import { WeatherForecast } from '../../weather/weather-forecast/weather-forecast';

@Component({
  selector: 'app-plan-detail',
  imports: [Loader, AreaSummary, WeatherForecast],
  templateUrl: './plan-detail.html',
})
export class PlanDetail {
  public readonly id = input.required<string>();

  protected readonly plan = httpResource<Plan>(() => `${API_BASE_URL}/plans/${this.id()}`);

  protected readonly center = computed(() => {
    const plan = this.plan.value();
    return plan ? areaCenter(plan.area) : null;
  });
}
