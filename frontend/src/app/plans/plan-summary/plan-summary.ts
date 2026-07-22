import { Component, computed, inject, input } from '@angular/core';
import { DatePipe } from '@angular/common';
import { httpResource } from '@angular/common/http';
import { rxResource } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { NgbAlert } from '@ng-bootstrap/ng-bootstrap';
import { of } from 'rxjs';
import { AuthService } from '../../auth/auth.service';
import { API_BASE_URL } from '../../core/api-base-url';
import { activityLabel } from '../../core/activity.model';
import { AREA_THEME_ICONS, AREA_THEME_LABELS } from '../../core/area-theme.model';
import { areaCenter, estimateReverseZoom } from '../../core/area.model';
import { GeocodingService } from '../../core/geocoding.service';
import { POI_TYPE_COLORS, POI_TYPE_ICONS } from '../../core/poi.model';
import { Loader } from '../../shared/loader/loader';
import { Stepper } from '../../shared/stepper/stepper';
import { WeatherForecast } from '../../weather/weather-forecast/weather-forecast';
import { Plan } from '../plan.model';
import { PlanService } from '../plan.service';
import { buildPlanSteps } from '../plan-steps';
import { PoiMap } from '../poi-map/poi-map';

@Component({
  selector: 'app-plan-summary',
  imports: [Loader, WeatherForecast, DatePipe, NgbAlert, RouterLink, PoiMap, Stepper],
  templateUrl: './plan-summary.html',
  styleUrl: './plan-summary.scss',
})
export class PlanSummary {
  public readonly id = input.required<string>();

  private readonly geocodingService = inject(GeocodingService);
  private readonly planService = inject(PlanService);
  protected readonly authService = inject(AuthService);

  protected readonly poiTypeIcons = POI_TYPE_ICONS;
  protected readonly poiTypeColors = POI_TYPE_COLORS;
  protected readonly areaThemeIcons = AREA_THEME_ICONS;
  protected readonly areaThemeLabels = AREA_THEME_LABELS;

  protected readonly plan = httpResource<Plan>(() => `${API_BASE_URL}/plans/${this.id()}`);

  protected readonly steps = computed(() => buildPlanSteps(this.plan.value(), this.id(), 'summary'));

  protected readonly items = rxResource({
    params: () => this.id(),
    stream: ({ params: id }) => this.planService.getItems(id),
  });

  protected readonly pois = computed(() => (this.items.value() ?? []).map((item) => item.poi));

  protected readonly selectedPoiIds = computed(
    () => new Set(this.pois().map((poi) => poi.id)),
  );

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

  protected readonly theme = computed(() => this.aiDescription.value()?.theme ?? 'default');

  protected readonly themeClass = computed(() =>
    this.authService.isAuthenticated() ? `theme-${this.theme()}` : '',
  );

  protected readonly narration = rxResource({
    params: () => {
      const items = this.items.value();
      return this.authService.isAuthenticated() && items && items.length > 0
        ? this.id()
        : undefined;
    },
    stream: ({ params: id }) => this.planService.generateNarration(id),
  });

  protected label(key: string): string {
    return activityLabel(key);
  }
}
