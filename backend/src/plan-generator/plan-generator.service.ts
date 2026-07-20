import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { areaBoundingBox, areaCenter } from '../plans/area.type';
import { PlansService } from '../plans/plans.service';
import { Poi, PoiType } from '../poi/poi.types';
import { PoiService } from '../poi/poi.service';
import { PrismaService } from '../prisma/prisma.service';
import { WeatherService } from '../weather/weather.service';
import { ACTIVITY_TO_POI_TYPES } from './activity-poi-mapping';
import { PlanItemWithPoi } from './plan-generator.types';

const ITEMS_PER_DAY = 4;
const OUTDOOR_TYPES: PoiType[] = ['trail'];

interface DayInfo {
  dayNumber: number;
  date: string;
  precipitationMm: number;
}

interface Assignment {
  poi: Poi;
  dayNumber: number;
  order: number;
}

type PlanItemRecord = Prisma.PlanItemGetPayload<{ include: { poi: true } }>;

@Injectable()
export class PlanGeneratorService {
  public constructor(
    private readonly prisma: PrismaService,
    private readonly plansService: PlansService,
    private readonly poiService: PoiService,
    private readonly weatherService: WeatherService,
  ) {}

  public async generate(planId: string): Promise<PlanItemWithPoi[]> {
    const plan = await this.plansService.findOne(planId);

    if (plan.activities.length === 0 || !plan.durationDays || !plan.startDate) {
      throw new BadRequestException(
        'Plan needs at least one activity and a trip duration before it can be generated',
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
    const center = areaCenter(plan.area);
    const [allPois, forecast] = await Promise.all([
      this.poiService.findInBoundingBox(bbox),
      this.weatherService.getForecast(center.lat, center.lng),
    ]);

    const candidates = allPois.filter((poi) => poiTypes.includes(poi.type));
    const cap = Math.min(candidates.length, plan.durationDays * ITEMS_PER_DAY);
    const selected = this.selectBalanced(candidates, poiTypes, cap);

    const days = this.buildDayInfos(
      plan.startDate,
      plan.durationDays,
      forecast.daily,
    );
    const assignments = this.assignToDays(selected, days);

    return this.persist(planId, assignments);
  }

  public async findItems(planId: string): Promise<PlanItemWithPoi[]> {
    await this.plansService.findOne(planId);

    const items = await this.prisma.planItem.findMany({
      where: { planId },
      include: { poi: true },
      orderBy: [{ dayNumber: 'asc' }, { order: 'asc' }],
    });

    return items.map((item) => this.toPlanItemWithPoi(item));
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

  private buildDayInfos(
    startDate: string,
    durationDays: number,
    daily: { date: string; precipitationMm: number }[],
  ): DayInfo[] {
    const forecastByDate = new Map(
      daily.map((day) => [day.date, day.precipitationMm]),
    );
    const start = new Date(startDate);

    return Array.from({ length: durationDays }, (_, index) => {
      const date = new Date(start);
      date.setDate(date.getDate() + index);
      const dateStr = date.toISOString().slice(0, 10);
      return {
        dayNumber: index + 1,
        date: dateStr,
        precipitationMm: forecastByDate.get(dateStr) ?? 0,
      };
    });
  }

  private assignToDays(pois: Poi[], days: DayInfo[]): Assignment[] {
    const outdoor = pois.filter((poi) => OUTDOOR_TYPES.includes(poi.type));
    const indoor = pois.filter((poi) => !OUTDOOR_TYPES.includes(poi.type));
    const driestFirst = [...days].sort(
      (a, b) => a.precipitationMm - b.precipitationMm,
    );

    const orderCounters = new Map<number, number>();
    const nextOrder = (dayNumber: number): number => {
      const current = (orderCounters.get(dayNumber) ?? 0) + 1;
      orderCounters.set(dayNumber, current);
      return current;
    };

    const assignments: Assignment[] = [];

    outdoor.forEach((poi, index) => {
      const dayNumber = driestFirst[index % driestFirst.length].dayNumber;
      assignments.push({ poi, dayNumber, order: nextOrder(dayNumber) });
    });

    indoor.forEach((poi, index) => {
      const dayNumber = days[index % days.length].dayNumber;
      assignments.push({ poi, dayNumber, order: nextOrder(dayNumber) });
    });

    return assignments;
  }

  private async persist(
    planId: string,
    assignments: Assignment[],
  ): Promise<PlanItemWithPoi[]> {
    const items = await this.prisma.$transaction(
      async (tx: Prisma.TransactionClient) => {
        await tx.planItem.deleteMany({ where: { planId } });
        await tx.plan.update({
          where: { id: planId },
          data: { status: 'generated' },
        });

        return Promise.all(
          assignments.map((assignment) =>
            tx.planItem.create({
              data: {
                planId,
                poiId: assignment.poi.id,
                order: assignment.order,
                dayNumber: assignment.dayNumber,
              },
              include: { poi: true },
            }),
          ),
        );
      },
    );

    return items
      .sort((a, b) => a.dayNumber - b.dayNumber || a.order - b.order)
      .map((item) => this.toPlanItemWithPoi(item));
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
