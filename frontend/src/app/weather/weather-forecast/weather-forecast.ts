import { Component, input } from '@angular/core';
import { DecimalPipe, DatePipe } from '@angular/common';
import { httpResource } from '@angular/common/http';
import { NgbAlert } from '@ng-bootstrap/ng-bootstrap';
import { API_BASE_URL } from '../../core/api-base-url';
import { Loader } from '../../shared/loader/loader';
import { weatherCodeToIcon } from '../weather-code';
import { Forecast } from '../weather.model';

@Component({
  selector: 'app-weather-forecast',
  imports: [Loader, NgbAlert, DecimalPipe, DatePipe],
  templateUrl: './weather-forecast.html',
  styleUrl: './weather-forecast.scss',
})
export class WeatherForecast {
  public readonly lat = input.required<number>();
  public readonly lng = input.required<number>();

  protected readonly forecast = httpResource<Forecast>(
    () => `${API_BASE_URL}/weather?lat=${this.lat()}&lng=${this.lng()}`,
  );

  protected readonly weatherCodeToIcon = weatherCodeToIcon;
}
