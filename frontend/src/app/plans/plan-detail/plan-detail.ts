import { Component, computed, inject, input } from '@angular/core';
import { DatePipe } from '@angular/common';
import { httpResource } from '@angular/common/http';
import { rxResource } from '@angular/core/rxjs-interop';
import { NgbAlert } from '@ng-bootstrap/ng-bootstrap';
import { of } from 'rxjs';
import { API_BASE_URL } from '../../core/api-base-url';
import { activityLabel } from '../../core/activity.model';
import { areaCenter, estimateReverseZoom } from '../../core/area.model';
import { GeocodingService } from '../../core/geocoding.service';
import { AuthService } from '../../auth/auth.service';
import { Loader } from '../../shared/loader/loader';
import { WeatherForecast } from '../../weather/weather-forecast/weather-forecast';
import { Plan } from '../plan.model';
import { PlanService } from '../plan.service';
import { PoiPicker } from '../poi-picker/poi-picker';

@Component({
  selector: 'app-plan-detail',
  imports: [Loader, WeatherForecast, DatePipe, PoiPicker, NgbAlert],
  templateUrl: './plan-detail.html',
})
export class PlanDetail {
  public readonly id = input.required<string>();

  private readonly geocodingService = inject(GeocodingService);
  private readonly planService = inject(PlanService);
  protected readonly authService = inject(AuthService);

  protected readonly plan = httpResource<Plan>(() => `${API_BASE_URL}/plans/${this.id()}`);

  protected readonly center = computed(() => {
    const plan = this.plan.value();
    return plan ? areaCenter(plan.area) : null;
  });

  protected readonly reverseZoom = computed(() => {
    const plan = this.plan.value();
    return plan ? estimateReverseZoom(plan.area) : undefined;
  });

  protected readonly placeName = rxResource({
    params: () => {
      const point = this.center();
      return point ? { ...point, zoom: this.reverseZoom() } : null;
    },
    stream: ({ params }) =>
      params ? this.geocodingService.reverse(params.lat, params.lng, params.zoom) : of(null),
  });

  protected readonly aiDescription = rxResource({
    params: () => (this.authService.isAuthenticated() ? this.id() : undefined),
    stream: ({ params: id }) => this.planService.getAiDescription(id),
  });

  protected label(key: string): string {
    return activityLabel(key);
  }
}
