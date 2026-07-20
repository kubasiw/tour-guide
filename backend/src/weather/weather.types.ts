export interface DailyForecast {
  date: string;
  weatherCode: number;
  tempMaxC: number;
  tempMinC: number;
  precipitationMm: number;
}

export type ForecastSource = 'forecast' | 'historical-estimate';

export interface Forecast {
  timezone: string;
  source: ForecastSource;
  daily: DailyForecast[];
}
