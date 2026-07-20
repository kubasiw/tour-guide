import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AreaDto } from './dto/area.dto';
import { CreatePlanDto } from './dto/create-plan.dto';
import { UpdatePlanDto } from './dto/update-plan.dto';
import { Area } from './area.type';

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
  public constructor(private readonly prisma: PrismaService) {}

  public async create(dto: CreatePlanDto): Promise<PlanWithArea> {
    const plan = await this.prisma.$transaction(
      async (tx: Prisma.TransactionClient) => {
        const created = await tx.plan.create({ data: {} });
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
