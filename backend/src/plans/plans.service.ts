import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePlanDto } from './dto/create-plan.dto';
import { Area } from './area.type';

export interface PlanWithArea {
  id: string;
  status: string;
  area: Area;
  createdAt: Date;
}

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

    return this.toPlanWithArea(
      plan.id,
      plan.status,
      plan.area.geometry,
      plan.createdAt,
    );
  }

  public async findOne(id: string): Promise<PlanWithArea> {
    const plan = await this.prisma.plan.findUnique({
      where: { id },
      include: { area: true },
    });

    if (!plan || !plan.area) {
      throw new NotFoundException('Plan not found');
    }

    return this.toPlanWithArea(
      plan.id,
      plan.status,
      plan.area.geometry,
      plan.createdAt,
    );
  }

  private toPlanWithArea(
    id: string,
    status: string,
    geometry: Prisma.JsonValue,
    createdAt: Date,
  ): PlanWithArea {
    return { id, status, area: geometry as unknown as Area, createdAt };
  }
}
