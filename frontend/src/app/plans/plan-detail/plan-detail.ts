import { Component, computed, inject, input } from '@angular/core';
import { DatePipe } from '@angular/common';
import { httpResource } from '@angular/common/http';
import { rxResource } from '@angular/core/rxjs-interop';
import { of } from 'rxjs';
import { API_BASE_URL } from '../../core/api-base-url';
import { activityLabel } from '../../core/activity.model';
import { areaCenter } from '../../core/area.model';
import { GeocodingService } from '../../core/geocoding.service';
import { Loader } from '../../shared/loader/loader';
import { WeatherForecast } from '../../weather/weather-forecast/weather-forecast';
import { Plan } from '../plan.model';
import { PoiPicker } from '../poi-picker/poi-picker';

@Component({
  selector: 'app-plan-detail',
  imports: [Loader, WeatherForecast, DatePipe, PoiPicker],
  templateUrl: './plan-detail.html',
})
export class PlanDetail {
  public readonly id = input.required<string>();

  private readonly geocodingService = inject(GeocodingService);

  protected readonly plan = httpResource<Plan>(() => `${API_BASE_URL}/plans/${this.id()}`);

  protected readonly center = computed(() => {
    const plan = this.plan.value();
    return plan ? areaCenter(plan.area) : null;
  });

  protected readonly placeName = rxResource({
    params: () => this.center(),
    stream: ({ params }) =>
      params ? this.geocodingService.reverse(params.lat, params.lng) : of(null),
  });

  protected label(key: string): string {
    return activityLabel(key);
  }
}
