import {
  BadGatewayException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Poi as PoiRecord, Prisma } from '@prisma/client';
import { AiService } from '../ai/ai.service';
import { PrismaService } from '../prisma/prisma.service';
import { GetPoisQueryDto } from './dto/get-pois-query.dto';
import { OVERPASS_TAG_QUERIES } from './overpass-tags';
import { Poi, PoiType, extractAddress } from './poi.types';

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
  public constructor(
    private readonly prisma: PrismaService,
    private readonly aiService: AiService,
  ) {}

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
    const name = element.tags?.name;
    if (!type || !name) {
      return null;
    }

    const osmId = `${element.type}/${element.id}`;
    const data = {
      name,
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

  // Cache-forever, same precedent as `PlansService.getAiDescription` — a
  // description is generated once per POI and reused across every plan/user
  // that later selects that same POI, so cost amortizes over time. This is
  // deliberately explicit-trigger (called only when a user clicks a specific
  // tile's "generate" action), never fired in bulk for a whole candidates
  // list — a naive "describe all 24 candidates on render" approach would
  // mean up to 24 LLM calls per page load.
  public async getOrGenerateDescription(
    id: string,
  ): Promise<{ description: string }> {
    const record = await this.prisma.poi.findUnique({ where: { id } });
    if (!record) {
      throw new NotFoundException('POI not found');
    }

    if (record.aiDescription) {
      return { description: record.aiDescription };
    }

    const description = await this.aiService.generatePoiDescription({
      name: record.name,
      type: record.type,
    });

    await this.prisma.poi.update({
      where: { id },
      data: {
        aiDescription: description,
        aiDescriptionGeneratedAt: new Date(),
      },
    });

    return { description };
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
      aiDescription: record.aiDescription,
      address: extractAddress(record.sourceData),
    };
  }
}
