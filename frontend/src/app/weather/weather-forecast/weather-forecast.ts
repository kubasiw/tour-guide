import { Component, input } from '@angular/core';
import { DecimalPipe, DatePipe } from '@angular/common';
import { httpResource } from '@angular/common/http';
import { NgbAlert } from '@ng-bootstrap/ng-bootstrap';
import { API_BASE_URL } from '../../core/api-base-url';
import { Loader } from '../../shared/loader/loader';
import { weatherCodeToIcon } from '../weather-code';
import { Forecast } from '../weather.model';

export const HISTORICAL_ESTIMATE_YEARS = 5;

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
}
