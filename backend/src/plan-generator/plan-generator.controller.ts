import { Controller, Get, Param, Post } from '@nestjs/common';
import { PlanGeneratorService } from './plan-generator.service';
import { PlanItemWithPoi } from './plan-generator.types';

@Controller('plans/:planId')
export class PlanGeneratorController {
  public constructor(
    private readonly planGeneratorService: PlanGeneratorService,
  ) {}

  @Post('generate')
  public generate(@Param('planId') planId: string): Promise<PlanItemWithPoi[]> {
    return this.planGeneratorService.generate(planId);
  }

  @Get('items')
  public findItems(
    @Param('planId') planId: string,
  ): Promise<PlanItemWithPoi[]> {
    return this.planGeneratorService.findItems(planId);
  }
}
