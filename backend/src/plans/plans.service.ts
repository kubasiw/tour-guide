import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AiService } from '../ai/ai.service';
import { GeocodingService } from '../geocoding/geocoding.service';
import { PrismaService } from '../prisma/prisma.service';
import { AreaDto } from './dto/area.dto';
import { CreatePlanDto } from './dto/create-plan.dto';
import { UpdatePlanDto } from './dto/update-plan.dto';
import { Area, areaCenter, estimateReverseZoom } from './area.type';

export interface PlanWithArea {
  id: string;
  status: string;
  area: Area;
  activities: string[];
  startDate: string | null;
  durationDays: number | null;
  createdAt: Date;
}

type PlanRecord = Prisma.PlanGetPayload<{ include: { area: true } }>;

@Injectable()
export class PlansService {
  public constructor(
    private readonly prisma: PrismaService,
    private readonly geocodingService: GeocodingService,
    private readonly aiService: AiService,
  ) {}

  public async create(
    dto: CreatePlanDto,
    userId?: string,
  ): Promise<PlanWithArea> {
    const plan = await this.prisma.$transaction(
      async (tx: Prisma.TransactionClient) => {
        const created = await tx.plan.create({ data: { userId } });
        const area = await tx.area.create({
          data: {
            planId: created.id,
            geometry: dto.area as unknown as Prisma.InputJsonValue,
          },
        });
        return { ...created, area };
      },
    );

    return this.toPlanWithArea(plan);
  }

  public async findAllForUser(userId: string): Promise<PlanWithArea[]> {
    const plans = await this.prisma.plan.findMany({
      where: { userId },
      include: { area: true },
      orderBy: { createdAt: 'desc' },
    });

    return plans
      .filter((plan) => plan.area !== null)
      .map((plan) => this.toPlanWithArea(plan));
  }

  public async findOne(id: string): Promise<PlanWithArea> {
    const plan = await this.prisma.plan.findUnique({
      where: { id },
      include: { area: true },
    });

    if (!plan) {
      throw new NotFoundException('Plan not found');
    }

    return this.toPlanWithArea(plan);
  }

  public async update(id: string, dto: UpdatePlanDto): Promise<PlanWithArea> {
    await this.findOne(id);

    const plan = await this.prisma.plan.update({
      where: { id },
      data: {
        ...(dto.activities !== undefined && { activities: dto.activities }),
        ...(dto.startDate !== undefined && { startDate: dto.startDate }),
        ...(dto.durationDays !== undefined && {
          durationDays: dto.durationDays,
        }),
      },
      include: { area: true },
    });

    return this.toPlanWithArea(plan);
  }

  public async updateArea(id: string, dto: AreaDto): Promise<PlanWithArea> {
    await this.findOne(id);

    const plan = await this.prisma.plan.update({
      where: { id },
      data: {
        area: {
          update: {
            geometry: dto as unknown as Prisma.InputJsonValue,
          },
        },
      },
      include: { area: true },
    });

    return this.toPlanWithArea(plan);
  }

  public async finalize(id: string): Promise<PlanWithArea> {
    await this.findOne(id);

    const itemCount = await this.prisma.planItem.count({
      where: { planId: id },
    });
    if (itemCount === 0) {
      throw new BadRequestException(
        'Plan needs at least one item before it can be finalized',
      );
    }

    const plan = await this.prisma.plan.update({
      where: { id },
      data: { status: 'final' },
      include: { area: true },
    });

    return this.toPlanWithArea(plan);
  }

  public async getAiDescription(id: string): Promise<{ description: string }> {
    const plan = await this.prisma.plan.findUnique({
      where: { id },
      include: { area: true },
    });

    if (!plan || !plan.area) {
      throw new NotFoundException('Plan not found');
    }

    if (plan.aiDescription) {
      return { description: plan.aiDescription };
    }

    const area = plan.area.geometry as unknown as Area;
    const center = areaCenter(area);
    const place = await this.geocodingService.reverse(
      center.lat,
      center.lng,
      estimateReverseZoom(area),
    );
    const description = await this.aiService.generateAreaDescription(
      place.displayName,
    );

    await this.prisma.plan.update({
      where: { id },
      data: {
        aiDescription: description,
        aiDescriptionGeneratedAt: new Date(),
      },
    });

    return { description };
  }

  private toPlanWithArea(plan: PlanRecord): PlanWithArea {
    if (!plan.area) {
      throw new NotFoundException('Plan not found');
    }

    return {
      id: plan.id,
      status: plan.status,
      area: plan.area.geometry as unknown as Area,
      activities: plan.activities,
      startDate: plan.startDate ? plan.startDate.toISOString() : null,
      durationDays: plan.durationDays,
      createdAt: plan.createdAt,
    };
  }
}
