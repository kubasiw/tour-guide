import { BadGatewayException, Injectable } from '@nestjs/common';
import { Poi as PoiRecord, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { GetPoisQueryDto } from './dto/get-pois-query.dto';
import { OVERPASS_TAG_QUERIES } from './overpass-tags';
import { Poi, PoiType } from './poi.types';

const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';

interface OverpassElement {
  type: string;
  id: number;
  lat: number;
  lon: number;
  tags?: Record<string, string>;
}

interface OverpassResponse {
  elements: OverpassElement[];
}

@Injectable()
export class PoiService {
  public constructor(private readonly prisma: PrismaService) {}

  public async findInBoundingBox(bbox: GetPoisQueryDto): Promise<Poi[]> {
    const cached = await this.prisma.poi.findMany({
      where: {
        lat: { gte: bbox.south, lte: bbox.north },
        lng: { gte: bbox.west, lte: bbox.east },
      },
    });

    if (cached.length > 0) {
      return cached.map((poi) => this.toPoi(poi));
    }

    const elements = await this.fetchFromOverpass(bbox);
    const saved = await Promise.all(
      elements.map((element) => this.upsertElement(element)),
    );

    return saved.filter((poi): poi is Poi => poi !== null);
  }

  private async fetchFromOverpass(
    bbox: GetPoisQueryDto,
  ): Promise<OverpassElement[]> {
    const query = this.buildQuery(bbox);
    const response = await fetch(OVERPASS_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        // Overpass's server responds 406 Not Acceptable to requests with no
        // User-Agent — Node's fetch doesn't send one by default (unlike curl).
        'User-Agent': 'tour-guide-app/0.1 (dev)',
      },
      body: `data=${encodeURIComponent(query)}`,
    });

    if (!response.ok) {
      throw new BadGatewayException('Failed to fetch POIs from Overpass');
    }

    const body = (await response.json()) as OverpassResponse;
    return body.elements;
  }

  private buildQuery(bbox: GetPoisQueryDto): string {
    const bboxStr = `${bbox.south},${bbox.west},${bbox.north},${bbox.east}`;
    const filters = Object.values(OVERPASS_TAG_QUERIES)
      .flat()
      .map((tag) => {
        const [key, value] = tag.split('=');
        return `node["${key}"="${value}"](${bboxStr});`;
      })
      .join('');

    return `[out:json][timeout:25];(${filters});out body;`;
  }

  private classify(tags: Record<string, string> | undefined): PoiType | null {
    if (!tags) {
      return null;
    }

    const entries = Object.entries(OVERPASS_TAG_QUERIES) as [
      PoiType,
      string[],
    ][];

    for (const [type, filters] of entries) {
      const matches = filters.some((tag) => {
        const [key, value] = tag.split('=');
        return tags[key] === value;
      });
      if (matches) {
        return type;
      }
    }

    return null;
  }

  private async upsertElement(element: OverpassElement): Promise<Poi | null> {
    const type = this.classify(element.tags);
    if (!type) {
      return null;
    }

    const osmId = `${element.type}/${element.id}`;
    const data = {
      name: element.tags?.name ?? 'Unnamed POI',
      type,
      lat: element.lat,
      lng: element.lon,
      openingHours: element.tags?.opening_hours ?? null,
      sourceData: (element.tags ?? {}) as unknown as Prisma.InputJsonValue,
    };

    const saved = await this.prisma.poi.upsert({
      where: { osmId },
      update: data,
      create: { osmId, ...data },
    });

    return this.toPoi(saved);
  }

  private toPoi(record: PoiRecord): Poi {
    return {
      id: record.id,
      osmId: record.osmId,
      name: record.name,
      type: record.type as PoiType,
      lat: record.lat,
      lng: record.lng,
      openingHours: record.openingHours,
    };
  }
}
