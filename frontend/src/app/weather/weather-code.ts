export interface WeatherIcon {
  icon: string;
  label: string;
}

// WMO weather codes, per Open-Meteo's docs.
const WEATHER_ICONS: Record<number, WeatherIcon> = {
  0: { icon: 'bi-sun-fill', label: 'Clear sky' },
  1: { icon: 'bi-cloud-sun-fill', label: 'Mainly clear' },
  2: { icon: 'bi-cloud-sun-fill', label: 'Partly cloudy' },
  3: { icon: 'bi-clouds-fill', label: 'Overcast' },
  45: { icon: 'bi-cloud-fog2-fill', label: 'Fog' },
  48: { icon: 'bi-cloud-fog2-fill', label: 'Fog' },
  51: { icon: 'bi-cloud-drizzle-fill', label: 'Light drizzle' },
  53: { icon: 'bi-cloud-drizzle-fill', label: 'Drizzle' },
  55: { icon: 'bi-cloud-drizzle-fill', label: 'Dense drizzle' },
  56: { icon: 'bi-cloud-drizzle-fill', label: 'Freezing drizzle' },
  57: { icon: 'bi-cloud-drizzle-fill', label: 'Freezing drizzle' },
  61: { icon: 'bi-cloud-rain-fill', label: 'Slight rain' },
  63: { icon: 'bi-cloud-rain-fill', label: 'Rain' },
  65: { icon: 'bi-cloud-rain-heavy-fill', label: 'Heavy rain' },
  66: { icon: 'bi-cloud-rain-fill', label: 'Freezing rain' },
  67: { icon: 'bi-cloud-rain-heavy-fill', label: 'Freezing rain' },
  71: { icon: 'bi-snow', label: 'Slight snow' },
  73: { icon: 'bi-snow', label: 'Snow' },
  75: { icon: 'bi-snow', label: 'Heavy snow' },
  77: { icon: 'bi-snow', label: 'Snow grains' },
  80: { icon: 'bi-cloud-rain-fill', label: 'Rain showers' },
  81: { icon: 'bi-cloud-rain-fill', label: 'Rain showers' },
  82: { icon: 'bi-cloud-rain-heavy-fill', label: 'Violent rain showers' },
  85: { icon: 'bi-snow', label: 'Snow showers' },
  86: { icon: 'bi-snow', label: 'Snow showers' },
  95: { icon: 'bi-cloud-lightning-rain-fill', label: 'Thunderstorm' },
  96: { icon: 'bi-cloud-lightning-rain-fill', label: 'Thunderstorm with hail' },
  99: { icon: 'bi-cloud-lightning-rain-fill', label: 'Thunderstorm with hail' },
};

const DEFAULT_ICON: WeatherIcon = { icon: 'bi-question-circle', label: 'Unknown' };

export function weatherCodeToIcon(code: number): WeatherIcon {
  return WEATHER_ICONS[code] ?? DEFAULT_ICON;
}
