import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { CreatePlanDto } from './dto/create-plan.dto';
import { PlansService, PlanWithArea } from './plans.service';

@Controller('plans')
export class PlansController {
  public constructor(private readonly plansService: PlansService) {}

  @Post()
  public create(@Body() dto: CreatePlanDto): Promise<PlanWithArea> {
    return this.plansService.create(dto);
  }

  @Get(':id')
  public findOne(@Param('id') id: string): Promise<PlanWithArea> {
    return this.plansService.findOne(id);
  }
}
