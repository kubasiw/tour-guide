import { Component, computed, inject, input, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { httpResource } from '@angular/common/http';
import { rxResource } from '@angular/core/rxjs-interop';
import { NgbAlert } from '@ng-bootstrap/ng-bootstrap';
import { API_BASE_URL } from '../../core/api-base-url';
import { activityLabel } from '../../core/activity.model';
import { areaCenter } from '../../core/area.model';
import { extractErrorMessage } from '../../core/http-error';
import { POI_TYPE_ICONS, PoiType } from '../../core/poi.model';
import { AreaSummary } from '../../shared/area-summary/area-summary';
import { Loader } from '../../shared/loader/loader';
import { WeatherForecast } from '../../weather/weather-forecast/weather-forecast';
import { PlanItemWithPoi } from '../plan-item.model';
import { Plan } from '../plan.model';
import { PlanService } from '../plan.service';

interface DayGroup {
  dayNumber: number;
  items: PlanItemWithPoi[];
}

@Component({
  selector: 'app-plan-detail',
  imports: [Loader, AreaSummary, WeatherForecast, DatePipe, NgbAlert],
  templateUrl: './plan-detail.html',
})
export class PlanDetail {
  public readonly id = input.required<string>();

  private readonly planService = inject(PlanService);

  protected readonly plan = httpResource<Plan>(() => `${API_BASE_URL}/plans/${this.id()}`);

  protected readonly items = rxResource({
    params: () => this.id(),
    stream: ({ params: id }) => this.planService.getItems(id),
  });

  protected readonly generating = signal(false);
  protected readonly generateError = signal<string | null>(null);

  protected readonly center = computed(() => {
    const plan = this.plan.value();
    return plan ? areaCenter(plan.area) : null;
  });

  protected readonly dayGroups = computed<DayGroup[]>(() => {
    const byDay = new Map<number, PlanItemWithPoi[]>();
    for (const item of this.items.value() ?? []) {
      const group = byDay.get(item.dayNumber) ?? [];
      group.push(item);
      byDay.set(item.dayNumber, group);
    }
    return [...byDay.entries()]
      .sort(([a], [b]) => a - b)
      .map(([dayNumber, items]) => ({ dayNumber, items }));
  });

  protected label(key: string): string {
    return activityLabel(key);
  }

  protected poiIcon(type: PoiType): string {
    return POI_TYPE_ICONS[type];
  }

  protected generatePlan(): void {
    this.generating.set(true);
    this.generateError.set(null);

    this.planService.generate(this.id()).subscribe({
      next: () => {
        this.generating.set(false);
        this.plan.reload();
        this.items.reload();
      },
      error: (err: unknown) => {
        this.generating.set(false);
        this.generateError.set(extractErrorMessage(err));
      },
    });
  }
}
