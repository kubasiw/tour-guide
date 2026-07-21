import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AiService } from '../ai/ai.service';
import { areaBoundingBox } from '../plans/area.type';
import { PlansService } from '../plans/plans.service';
import { Poi, PoiType } from '../poi/poi.types';
import { PoiService } from '../poi/poi.service';
import { PrismaService } from '../prisma/prisma.service';
import { ACTIVITY_TO_POI_TYPES } from './activity-poi-mapping';
import { PlanItemWithPoi } from './plan-generator.types';

const MAX_CANDIDATES = 24;

type PlanItemRecord = Prisma.PlanItemGetPayload<{ include: { poi: true } }>;

@Injectable()
export class PlanGeneratorService {
  public constructor(
    private readonly prisma: PrismaService,
    private readonly plansService: PlansService,
    private readonly poiService: PoiService,
    private readonly aiService: AiService,
  ) {}

  public async findCandidates(planId: string): Promise<Poi[]> {
    const plan = await this.plansService.findOne(planId);

    if (plan.activities.length === 0) {
      throw new BadRequestException(
        'Plan needs at least one activity before candidates can be found',
      );
    }

    const poiTypes = [
      ...new Set(
        plan.activities.flatMap(
          (activity) => ACTIVITY_TO_POI_TYPES[activity] ?? [],
        ),
      ),
    ];

    const bbox = areaBoundingBox(plan.area);
    const allPois = await this.poiService.findInBoundingBox(bbox);
    const candidates = allPois.filter((poi) => poiTypes.includes(poi.type));

    return this.selectBalanced(
      candidates,
      poiTypes,
      Math.min(candidates.length, MAX_CANDIDATES),
    );
  }

  public async findItems(planId: string): Promise<PlanItemWithPoi[]> {
    await this.plansService.findOne(planId);

    const items = await this.prisma.planItem.findMany({
      where: { planId },
      include: { poi: true },
      orderBy: [{ order: 'asc' }],
    });

    return items.map((item) => this.toPlanItemWithPoi(item));
  }

  public async addItem(
    planId: string,
    poiId: string,
  ): Promise<PlanItemWithPoi> {
    await this.plansService.findOne(planId);

    const poi = await this.prisma.poi.findUnique({ where: { id: poiId } });
    if (!poi) {
      throw new NotFoundException('POI not found');
    }

    const existingCount = await this.prisma.planItem.count({
      where: { planId },
    });

    try {
      const item = await this.prisma.planItem.create({
        data: { planId, poiId, order: existingCount + 1, dayNumber: null },
        include: { poi: true },
      });
      return this.toPlanItemWithPoi(item);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('POI is already in this plan');
      }
      throw error;
    }
  }

  public async removeItem(planId: string, itemId: string): Promise<void> {
    const item = await this.prisma.planItem.findUnique({
      where: { id: itemId },
    });
    if (!item || item.planId !== planId) {
      throw new NotFoundException('Plan item not found');
    }

    await this.prisma.planItem.delete({ where: { id: itemId } });
  }

  public async reorderItems(
    planId: string,
    itemIds: string[],
  ): Promise<PlanItemWithPoi[]> {
    await this.plansService.findOne(planId);

    const existing = await this.prisma.planItem.findMany({
      where: { planId },
      select: { id: true },
    });
    const existingIds = new Set(existing.map((item) => item.id));
    const requestedIds = new Set(itemIds);

    if (
      existingIds.size !== requestedIds.size ||
      ![...existingIds].every((id) => requestedIds.has(id))
    ) {
      throw new BadRequestException(
        "itemIds must match the plan's current items exactly",
      );
    }

    await this.prisma.$transaction(
      itemIds.map((id, index) =>
        this.prisma.planItem.update({
          where: { id },
          data: { order: index + 1 },
        }),
      ),
    );

    return this.findItems(planId);
  }

  public async generateNarration(
    planId: string,
  ): Promise<{ narration: string }> {
    const plan = await this.plansService.findOne(planId);
    const items = await this.findItems(planId);

    if (items.length === 0) {
      throw new BadRequestException(
        'Plan needs at least one item before it can be narrated',
      );
    }

    const narration = await this.aiService.generatePlanNarration(
      items.map((item) => ({ name: item.poi.name, type: item.poi.type })),
      plan.activities,
    );

    return { narration };
  }

  private selectBalanced(
    candidates: Poi[],
    types: PoiType[],
    cap: number,
  ): Poi[] {
    const queues = new Map<PoiType, Poi[]>(
      types.map((type) => [
        type,
        candidates.filter((poi) => poi.type === type),
      ]),
    );

    const selected: Poi[] = [];
    let madeProgress = true;

    while (selected.length < cap && madeProgress) {
      madeProgress = false;
      for (const type of types) {
        if (selected.length >= cap) {
          break;
        }
        const next = queues.get(type)?.shift();
        if (next) {
          selected.push(next);
          madeProgress = true;
        }
      }
    }

    return selected;
  }

  private toPlanItemWithPoi(item: PlanItemRecord): PlanItemWithPoi {
    return {
      id: item.id,
      order: item.order,
      dayNumber: item.dayNumber,
      note: item.note,
      userModified: item.userModified,
      poi: {
        id: item.poi.id,
        osmId: item.poi.osmId,
        name: item.poi.name,
        type: item.poi.type as PoiType,
        lat: item.poi.lat,
        lng: item.poi.lng,
        openingHours: item.poi.openingHours,
      },
    };
  }
}
