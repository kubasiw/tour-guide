import { PoiType } from '../poi/poi.types';

export const ACTIVITY_TO_POI_TYPES: Record<string, PoiType[]> = {
  hiking: ['trail', 'shelter'],
  sightseeing: ['monument'],
  culture: ['monument'],
  food: ['restaurant'],
  nightlife: ['nightlife'],
  relax: ['accommodation'],
};
