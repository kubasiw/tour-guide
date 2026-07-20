export interface WeatherIcon {
  icon: string;
  label: string;
  colorClass: string;
}

// WMO weather codes, per Open-Meteo's docs.
const WEATHER_ICONS: Record<number, WeatherIcon> = {
  0: { icon: 'bi-sun-fill', label: 'Clear sky', colorClass: 'text-warning' },
  1: { icon: 'bi-cloud-sun-fill', label: 'Mainly clear', colorClass: 'text-warning' },
  2: { icon: 'bi-cloud-sun-fill', label: 'Partly cloudy', colorClass: 'text-secondary' },
  3: { icon: 'bi-clouds-fill', label: 'Overcast', colorClass: 'text-secondary' },
  45: { icon: 'bi-cloud-fog2-fill', label: 'Fog', colorClass: 'text-secondary' },
  48: { icon: 'bi-cloud-fog2-fill', label: 'Fog', colorClass: 'text-secondary' },
  51: { icon: 'bi-cloud-drizzle-fill', label: 'Light drizzle', colorClass: 'text-info' },
  53: { icon: 'bi-cloud-drizzle-fill', label: 'Drizzle', colorClass: 'text-info' },
  55: { icon: 'bi-cloud-drizzle-fill', label: 'Dense drizzle', colorClass: 'text-info' },
  56: { icon: 'bi-cloud-drizzle-fill', label: 'Freezing drizzle', colorClass: 'text-info' },
  57: { icon: 'bi-cloud-drizzle-fill', label: 'Freezing drizzle', colorClass: 'text-info' },
  61: { icon: 'bi-cloud-rain-fill', label: 'Slight rain', colorClass: 'text-info' },
  63: { icon: 'bi-cloud-rain-fill', label: 'Rain', colorClass: 'text-info' },
  65: { icon: 'bi-cloud-rain-heavy-fill', label: 'Heavy rain', colorClass: 'text-info' },
  66: { icon: 'bi-cloud-rain-fill', label: 'Freezing rain', colorClass: 'text-info' },
  67: { icon: 'bi-cloud-rain-heavy-fill', label: 'Freezing rain', colorClass: 'text-info' },
  71: { icon: 'bi-snow', label: 'Slight snow', colorClass: 'text-info' },
  73: { icon: 'bi-snow', label: 'Snow', colorClass: 'text-info' },
  75: { icon: 'bi-snow', label: 'Heavy snow', colorClass: 'text-info' },
  77: { icon: 'bi-snow', label: 'Snow grains', colorClass: 'text-info' },
  80: { icon: 'bi-cloud-rain-fill', label: 'Rain showers', colorClass: 'text-info' },
  81: { icon: 'bi-cloud-rain-fill', label: 'Rain showers', colorClass: 'text-info' },
  82: { icon: 'bi-cloud-rain-heavy-fill', label: 'Violent rain showers', colorClass: 'text-info' },
  85: { icon: 'bi-snow', label: 'Snow showers', colorClass: 'text-info' },
  86: { icon: 'bi-snow', label: 'Snow showers', colorClass: 'text-info' },
  95: {
    icon: 'bi-cloud-lightning-rain-fill',
    label: 'Thunderstorm',
    colorClass: 'text-danger',
  },
  96: {
    icon: 'bi-cloud-lightning-rain-fill',
    label: 'Thunderstorm with hail',
    colorClass: 'text-danger',
  },
  99: {
    icon: 'bi-cloud-lightning-rain-fill',
    label: 'Thunderstorm with hail',
    colorClass: 'text-danger',
  },
};

const DEFAULT_ICON: WeatherIcon = {
  icon: 'bi-question-circle',
  label: 'Unknown',
  colorClass: 'text-secondary',
};

export function weatherCodeToIcon(code: number): WeatherIcon {
  return WEATHER_ICONS[code] ?? DEFAULT_ICON;
}
