import { BadGatewayException, Injectable } from '@nestjs/common';
import { DailyForecast, Forecast } from './weather.types';

interface OpenMeteoResponse {
  timezone: string;
  daily: {
    time: string[];
    weather_code: number[];
    temperature_2m_max: number[];
    temperature_2m_min: number[];
    precipitation_sum: number[];
  };
}

const OPEN_METEO_URL = 'https://api.open-meteo.com/v1/forecast';
const FORECAST_DAYS = 5;

@Injectable()
export class WeatherService {
  public async getForecast(lat: number, lng: number): Promise<Forecast> {
    const url = new URL(OPEN_METEO_URL);
    url.searchParams.set('latitude', String(lat));
    url.searchParams.set('longitude', String(lng));
    url.searchParams.set(
      'daily',
      'weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum',
    );
    url.searchParams.set('timezone', 'auto');
    url.searchParams.set('forecast_days', String(FORECAST_DAYS));

    const response = await fetch(url);
    if (!response.ok) {
      throw new BadGatewayException('Failed to fetch forecast from Open-Meteo');
    }

    const body = (await response.json()) as OpenMeteoResponse;
    return {
      timezone: body.timezone,
      daily: body.daily.time.map((date, index) =>
        this.toDailyForecast(body, date, index),
      ),
    };
  }

  private toDailyForecast(
    body: OpenMeteoResponse,
    date: string,
    index: number,
  ): DailyForecast {
    return {
      date,
      weatherCode: body.daily.weather_code[index],
      tempMaxC: body.daily.temperature_2m_max[index],
      tempMinC: body.daily.temperature_2m_min[index],
      precipitationMm: body.daily.precipitation_sum[index],
    };
  }
}
