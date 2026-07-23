import { BadGatewayException, Injectable } from '@nestjs/common';
import { Trail as TrailRecord } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { GetTrailsQueryDto } from './dto/get-trails-query.dto';
import { LatLng, Trail, TrailGeometry } from './trails.types';

const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';
const WAYMARKED_TRAILS_URL = 'https://hiking.waymarkedtrails.org/api/v1';
// Both Overpass and Waymarked Trails reject/misbehave on requests with no
// User-Agent — Node's fetch doesn't send one by default (unlike curl), same
// gotcha already documented for PoiService/GeocodingService.
const USER_AGENT = 'tour-guide-app/0.1 (dev)';

// Earth radius used by Web Mercator (EPSG:3857) — confirmed live (2026-07-23)
// that Waymarked Trails' `/details/relation/{id}` endpoint returns geometry
// in this projection, not plain WGS84 lat/lng (coordinates like
// [2185178.2, 6468042.15], not [19.9, 50.06]). Cross-checked this formula's
// output against a real returned coordinate pair and it matched the actual
// real-world location (~50.03°N, 19.6°E, Krzeszowice near Kraków) — verified,
// not copied from documentation alone.
const EARTH_RADIUS = 6378137;

interface OverpassRelationElement {
  type: string;
  id: number;
  tags?: Record<string, string>;
}

interface OverpassResponse {
  elements: OverpassRelationElement[];
}

interface WaymarkedWayGeometry {
  type: string;
  coordinates: [number, number][];
}

interface WaymarkedWay {
  geometry: WaymarkedWayGeometry;
}

interface WaymarkedRouteSegment {
  ways: WaymarkedWay[];
}

interface WaymarkedDetailsResponse {
  name?: string;
  route?: {
    main: WaymarkedRouteSegment[];
  };
}

@Injectable()
export class TrailsService {
  public constructor(private readonly prisma: PrismaService) {}

  // Discovery only — Waymarked Trails' own search is by name, not bbox (its
  // `bbox` query param on `/list/search` is silently ignored, confirmed
  // live), so finding "what hiking routes exist in this area" goes through
  // Overpass instead, same data source/pattern PoiService already uses.
  // Upserts each result into `Trail` (keyed by `osmId`, same pattern as
  // `PoiService.upsertElement`) so the returned `id` is a real DB row —
  // needed so a discovered trail can immediately be referenced by
  // `PlanTrailItem.trailId` when the user adds it to a plan.
  public async findInBoundingBox(bbox: GetTrailsQueryDto): Promise<Trail[]> {
    const query =
      `[out:json][timeout:25];` +
      `relation["route"="hiking"](${bbox.south},${bbox.west},${bbox.north},${bbox.east});` +
      `out ids tags;`;

    const response = await fetch(OVERPASS_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': USER_AGENT,
      },
      body: `data=${encodeURIComponent(query)}`,
    });

    if (!response.ok) {
      throw new BadGatewayException('Failed to fetch trails from Overpass');
    }

    const body = (await response.json()) as OverpassResponse;
    const named = body.elements.filter((element) =>
      Boolean(element.tags?.name),
    );

    return Promise.all(named.map((element) => this.upsertTrail(element)));
  }

  private async upsertTrail(element: OverpassRelationElement): Promise<Trail> {
    const tags = element.tags!;
    const osmId = String(element.id);
    const data = {
      name: tags.name,
      ref: tags.ref ?? null,
      colour: tags.colour ?? null,
      distanceKm: tags.distance ? Number(tags.distance) : null,
    };

    const saved = await this.prisma.trail.upsert({
      where: { osmId },
      update: data,
      create: { osmId, ...data },
    });

    return this.toTrail(saved);
  }

  private toTrail(record: TrailRecord): Trail {
    return {
      id: record.id,
      osmId: record.osmId,
      name: record.name,
      ref: record.ref,
      colour: record.colour,
      distanceKm: record.distanceKm,
    };
  }

  // The real geometry, once the user has picked a specific trail — a
  // separate call by design (not bundled into `findInBoundingBox`), since
  // Overpass's own relation tags don't include geometry and fetching every
  // discovered trail's full geometry up front would be wasteful for an area
  // that might list a dozen routes the user never clicks.
  public async getGeometry(osmId: string): Promise<TrailGeometry> {
    const response = await fetch(
      `${WAYMARKED_TRAILS_URL}/details/relation/${osmId}`,
      {
        headers: { 'User-Agent': USER_AGENT },
      },
    );

    if (!response.ok) {
      throw new BadGatewayException(
        'Failed to fetch trail geometry from Waymarked Trails',
      );
    }

    const body = (await response.json()) as WaymarkedDetailsResponse;
    const ways = body.route?.main.flatMap((segment) => segment.ways) ?? [];

    return {
      id: osmId,
      name: body.name ?? '',
      segments: ways.map((way) =>
        way.geometry.coordinates.map(([x, y]) =>
          this.unprojectWebMercator(x, y),
        ),
      ),
    };
  }

  private unprojectWebMercator(x: number, y: number): LatLng {
    const lng = (x / EARTH_RADIUS) * (180 / Math.PI);
    const lat =
      (2 * Math.atan(Math.exp(y / EARTH_RADIUS)) - Math.PI / 2) *
      (180 / Math.PI);
    return { lat, lng };
  }
}
