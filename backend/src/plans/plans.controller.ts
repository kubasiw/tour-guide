import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { AreaDto } from './dto/area.dto';
import { CreatePlanDto } from './dto/create-plan.dto';
import { UpdatePlanDto } from './dto/update-plan.dto';
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

  @Patch(':id')
  public update(
    @Param('id') id: string,
    @Body() dto: UpdatePlanDto,
  ): Promise<PlanWithArea> {
    return this.plansService.update(id, dto);
  }

  @Patch(':id/area')
  public updateArea(
    @Param('id') id: string,
    @Body() dto: AreaDto,
  ): Promise<PlanWithArea> {
    return this.plansService.updateArea(id, dto);
  }
}
