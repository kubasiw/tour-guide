import { BadGatewayException, Injectable } from '@nestjs/common';
import { GeocodeReverseResult, GeocodeSearchResult } from './geocoding.types';

const NOMINATIM_URL = 'https://nominatim.openstreetmap.org';
// Nominatim's usage policy requires a User-Agent identifying the app — Node's
// fetch doesn't send one by default (unlike curl), same gotcha as Overpass.
const USER_AGENT = 'tour-guide-app/0.1 (dev)';
const SEARCH_RESULT_LIMIT = 5;

interface NominatimSearchItem {
  display_name: string;
  lat: string;
  lon: string;
  boundingbox?: [string, string, string, string];
}

interface NominatimAddress {
  suburb?: string;
  city_district?: string;
  neighbourhood?: string;
  city?: string;
  town?: string;
  village?: string;
  county?: string;
}

interface NominatimReverseResponse {
  display_name: string;
  address?: NominatimAddress;
}

@Injectable()
export class GeocodingService {
  public async search(query: string): Promise<GeocodeSearchResult[]> {
    const url = new URL(`${NOMINATIM_URL}/search`);
    url.searchParams.set('q', query);
    url.searchParams.set('format', 'json');
    url.searchParams.set('limit', String(SEARCH_RESULT_LIMIT));

    const results = await this.fetchJson<NominatimSearchItem[]>(url);

    return results.map((result) => ({
      displayName: result.display_name,
      lat: Number(result.lat),
      lng: Number(result.lon),
      boundingBox: result.boundingbox
        ? {
            south: Number(result.boundingbox[0]),
            north: Number(result.boundingbox[1]),
            west: Number(result.boundingbox[2]),
            east: Number(result.boundingbox[3]),
          }
        : null,
    }));
  }

  public async reverse(
    lat: number,
    lng: number,
    zoom = 18,
  ): Promise<GeocodeReverseResult> {
    const url = new URL(`${NOMINATIM_URL}/reverse`);
    url.searchParams.set('lat', String(lat));
    url.searchParams.set('lon', String(lng));
    url.searchParams.set('format', 'json');
    url.searchParams.set('addressdetails', '1');
    url.searchParams.set('zoom', String(zoom));

    const body = await this.fetchJson<NominatimReverseResponse>(url);
    return { displayName: this.buildShortName(body) };
  }

  private buildShortName(body: NominatimReverseResponse): string {
    const address = body.address ?? {};
    const area =
      address.suburb ?? address.city_district ?? address.neighbourhood;
    const city =
      address.city ?? address.town ?? address.village ?? address.county;

    if (city && area && city !== area) {
      return `${city} — ${area}`;
    }

    return city ?? area ?? body.display_name;
  }

  private async fetchJson<T>(url: URL): Promise<T> {
    const response = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT },
    });

    if (!response.ok) {
      throw new BadGatewayException('Failed to fetch data from Nominatim');
    }

    return (await response.json()) as T;
  }
}
