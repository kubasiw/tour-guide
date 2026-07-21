export const AREA_THEMES = [
  'coastal',
  'mountain-trail',
  'urban',
  'countryside',
  'default',
] as const;

export type AreaTheme = (typeof AREA_THEMES)[number];

export const AREA_THEME_ICONS: Record<AreaTheme, string> = {
  coastal: 'bi-water',
  'mountain-trail': 'bi-signpost-2-fill',
  urban: 'bi-building',
  countryside: 'bi-tree-fill',
  default: 'bi-geo-alt-fill',
};

export const AREA_THEME_LABELS: Record<AreaTheme, string> = {
  coastal: 'Wybrzeże',
  'mountain-trail': 'Górski szlak',
  urban: 'Miasto',
  countryside: 'Wieś i natura',
  default: 'Ogólny',
};
