import { Component, computed, input } from '@angular/core';
import { DecimalPipe, DatePipe } from '@angular/common';
import { httpResource } from '@angular/common/http';
import { NgbAlert } from '@ng-bootstrap/ng-bootstrap';
import { API_BASE_URL } from '../../core/api-base-url';
import { Loader } from '../../shared/loader/loader';
import { weatherCodeToIcon } from '../weather-code';
import { Forecast } from '../weather.model';

export const HISTORICAL_ESTIMATE_YEARS = 5;
const FALLBACK_DAY_COUNT = 5;
const MAX_SKELETON_DAYS = 9;

function addDaysToDateString(date: string, days: number): string {
  const parsed = new Date(`${date}T00:00:00Z`);
  parsed.setUTCDate(parsed.getUTCDate() + days);
  return parsed.toISOString().slice(0, 10);
}

@Component({
  selector: 'app-weather-forecast',
  imports: [Loader, NgbAlert, DecimalPipe, DatePipe],
  templateUrl: './weather-forecast.html',
  styleUrl: './weather-forecast.scss',
})
export class WeatherForecast {
  public readonly lat = input.required<number>();
  public readonly lng = input.required<number>();
  public readonly startDate = input<string | null>();
  public readonly durationDays = input<number | null>();

  protected readonly historicalEstimateYears = HISTORICAL_ESTIMATE_YEARS;

  protected readonly skeletonDays = computed(() => {
    const count = Math.min((this.durationDays() ?? FALLBACK_DAY_COUNT) + 4, MAX_SKELETON_DAYS);
    return Array.from({ length: count }, (_, index) => index);
  });

  protected readonly tripEndDate = computed(() => {
    const startDate = this.startDate();
    const durationDays = this.durationDays();
    return startDate && durationDays ? addDaysToDateString(startDate, durationDays - 1) : null;
  });

  protected readonly forecast = httpResource<Forecast>(() => {
    const params = new URLSearchParams({
      lat: String(this.lat()),
      lng: String(this.lng()),
    });

    const startDate = this.startDate();
    const durationDays = this.durationDays();
    if (startDate && durationDays) {
      params.set('startDate', startDate);
      params.set('durationDays', String(durationDays));
    }

    return `${API_BASE_URL}/weather?${params.toString()}`;
  });

  protected readonly weatherCodeToIcon = weatherCodeToIcon;

  protected isInTrip(date: string): boolean {
    const startDate = this.startDate();
    const endDate = this.tripEndDate();
    if (!startDate || !endDate) {
      return true;
    }
    return date >= startDate && date <= endDate;
  }
}
