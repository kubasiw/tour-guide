export interface DailyForecast {
  date: string;
  weatherCode: number;
  tempMaxC: number;
  tempMinC: number;
  precipitationMm: number;
}

export interface Forecast {
  timezone: string;
  daily: DailyForecast[];
}
