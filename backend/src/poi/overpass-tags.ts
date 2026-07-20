import { PoiType } from './poi.types';

export const OVERPASS_TAG_QUERIES: Record<PoiType, string[]> = {
  restaurant: ['amenity=restaurant', 'amenity=cafe', 'amenity=fast_food'],
  monument: [
    'historic=monument',
    'historic=memorial',
    'tourism=attraction',
    'tourism=artwork',
  ],
  accommodation: [
    'tourism=hotel',
    'tourism=guest_house',
    'tourism=hostel',
    'tourism=camp_site',
  ],
  shelter: ['amenity=shelter', 'tourism=alpine_hut'],
  trail: ['tourism=trailhead'],
};
