export interface ActivityOption {
  key: string;
  label: string;
  icon: string;
}

export const ACTIVITIES: ActivityOption[] = [
  { key: 'hiking', label: 'Wędrówki', icon: 'bi-signpost-2' },
  { key: 'sightseeing', label: 'Zwiedzanie', icon: 'bi-camera' },
  { key: 'culture', label: 'Kultura', icon: 'bi-bank' },
  { key: 'food', label: 'Jedzenie', icon: 'bi-cup-hot' },
  { key: 'nightlife', label: 'Życie nocne', icon: 'bi-moon-stars' },
  { key: 'relax', label: 'Relaks', icon: 'bi-umbrella' },
];

export function activityLabel(key: string): string {
  return ACTIVITIES.find((activity) => activity.key === key)?.label ?? key;
}
