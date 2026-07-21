import { BadGatewayException, Injectable } from '@nestjs/common';
import { DailyForecast, Forecast } from './weather.types';

interface OpenMeteoDaily {
  time: string[];
  weather_code: number[];
  temperature_2m_max: number[];
  temperature_2m_min: number[];
  precipitation_sum: number[];
}

interface OpenMeteoResponse {
  timezone: string;
  daily: OpenMeteoDaily;
}

const FORECAST_URL = 'https://api.open-meteo.com/v1/forecast';
const ARCHIVE_URL = 'https://archive-api.open-meteo.com/v1/archive';
const DAILY_FIELDS =
  'weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum';
const FORECAST_DAYS = 5;
// How far ahead Open-Meteo's real forecast is trusted for — comfortably inside
// its actual ~16-day limit, and matches the "2 weeks" framing this was agreed
// on with the user. Beyond this, we fall back to a historical average instead.
const FORECAST_HORIZON_DAYS = 14;
// How many past years to average for a historical estimate. Not a rigorously
// chosen statistic — just enough to smooth out one unusually hot/cold year
// without firing off excessive requests.
const HISTORICAL_YEARS = 5;
// Extra days shown before/after the trip's real dates (real-forecast path
// only) so the user sees the weather trend leading into and out of the trip.
const CONTEXT_DAYS = 2;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

@Injectable()
export class WeatherService {
  public async getForecast(
    lat: number,
    lng: number,
    startDate?: string,
    durationDays?: number,
  ): Promise<Forecast> {
    if (!startDate || !durationDays) {
      const today = this.formatDate(new Date());
      return this.fetchForecast(
        lat,
        lng,
        today,
        this.addDays(today, FORECAST_DAYS - 1),
      );
    }

    const daysUntilTrip = this.diffInDays(
      this.formatDate(new Date()),
      startDate,
    );
    if (daysUntilTrip <= FORECAST_HORIZON_DAYS) {
      const rangeStart = this.addDays(startDate, -CONTEXT_DAYS);
      const rangeEnd = this.addDays(
        this.addDays(startDate, durationDays - 1),
        CONTEXT_DAYS,
      );
      return this.fetchForecast(lat, lng, rangeStart, rangeEnd);
    }

    return this.fetchHistoricalAverage(lat, lng, startDate, durationDays);
  }

  private async fetchForecast(
    lat: number,
    lng: number,
    startDate: string,
    endDate: string,
  ): Promise<Forecast> {
    const url = new URL(FORECAST_URL);
    url.searchParams.set('latitude', String(lat));
    url.searchParams.set('longitude', String(lng));
    url.searchParams.set('daily', DAILY_FIELDS);
    url.searchParams.set('timezone', 'auto');
    url.searchParams.set('start_date', startDate);
    url.searchParams.set('end_date', endDate);

    const body = await this.fetchJson(url);
    return {
      timezone: body.timezone,
      source: 'forecast',
      daily: body.daily.time.map((date, index) =>
        this.toDailyForecast(body.daily, index, date),
      ),
    };
  }

  private async fetchHistoricalAverage(
    lat: number,
    lng: number,
    startDate: string,
    durationDays: number,
  ): Promise<Forecast> {
    const endDate = this.addDays(startDate, durationDays - 1);
    const yearsAgoList = Array.from(
      { length: HISTORICAL_YEARS },
      (_, i) => i + 1,
    );

    const yearlyResponses = await Promise.all(
      yearsAgoList.map((yearsAgo) => {
        const url = new URL(ARCHIVE_URL);
        url.searchParams.set('latitude', String(lat));
        url.searchParams.set('longitude', String(lng));
        url.searchParams.set('daily', DAILY_FIELDS);
        url.searchParams.set('timezone', 'auto');
        url.searchParams.set(
          'start_date',
          this.shiftYears(startDate, -yearsAgo),
        );
        url.searchParams.set('end_date', this.shiftYears(endDate, -yearsAgo));
        return this.fetchJson(url);
      }),
    );

    const daily: DailyForecast[] = Array.from(
      { length: durationDays },
      (_, dayIndex) => {
        const samples = yearlyResponses.map((response) =>
          this.toDailyForecast(
            response.daily,
            dayIndex,
            response.daily.time[dayIndex],
          ),
        );

        return {
          date: this.addDays(startDate, dayIndex),
          weatherCode: this.mostFrequentCode(
            samples.map((sample) => sample.weatherCode),
          ),
          tempMaxC: this.average(samples.map((sample) => sample.tempMaxC)),
          tempMinC: this.average(samples.map((sample) => sample.tempMinC)),
          precipitationMm: this.average(
            samples.map((sample) => sample.precipitationMm),
          ),
        };
      },
    );

    return { timezone: 'UTC', source: 'historical-estimate', daily };
  }

  private async fetchJson(url: URL): Promise<OpenMeteoResponse> {
    const response = await fetch(url);
    if (!response.ok) {
      throw new BadGatewayException(
        'Failed to fetch weather data from Open-Meteo',
      );
    }

    return (await response.json()) as OpenMeteoResponse;
  }

  private toDailyForecast(
    daily: OpenMeteoDaily,
    index: number,
    date: string,
  ): DailyForecast {
    return {
      date,
      weatherCode: daily.weather_code[index],
      tempMaxC: daily.temperature_2m_max[index],
      tempMinC: daily.temperature_2m_min[index],
      precipitationMm: daily.precipitation_sum[index],
    };
  }

  private average(values: number[]): number {
    const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
    return Math.round(mean * 10) / 10;
  }

  private mostFrequentCode(codes: number[]): number {
    const counts = new Map<number, number>();
    for (const code of codes) {
      counts.set(code, (counts.get(code) ?? 0) + 1);
    }

    let best = codes[0];
    let bestCount = 0;
    for (const [code, count] of counts) {
      if (count > bestCount) {
        best = code;
        bestCount = count;
      }
    }
    return best;
  }

  private formatDate(date: Date): string {
    return date.toISOString().slice(0, 10);
  }

  private addDays(dateStr: string, days: number): string {
    const date = new Date(`${dateStr}T00:00:00Z`);
    date.setUTCDate(date.getUTCDate() + days);
    return this.formatDate(date);
  }

  private diffInDays(fromStr: string, toStr: string): number {
    const from = new Date(`${fromStr}T00:00:00Z`).getTime();
    const to = new Date(`${toStr}T00:00:00Z`).getTime();
    return Math.round((to - from) / MS_PER_DAY);
  }

  private shiftYears(dateStr: string, years: number): string {
    const date = new Date(`${dateStr}T00:00:00Z`);
    date.setUTCFullYear(date.getUTCFullYear() + years);
    return this.formatDate(date);
  }
}
