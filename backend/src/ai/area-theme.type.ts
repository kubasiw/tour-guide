export const AREA_THEMES = [
  'coastal',
  'mountain-trail',
  'urban',
  'countryside',
  'default',
] as const;

export type AreaTheme = (typeof AREA_THEMES)[number];
