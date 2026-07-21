import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  CurrentUser,
  type CurrentUserPayload,
} from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt-auth.guard';
import { AreaDto } from './dto/area.dto';
import { CreatePlanDto } from './dto/create-plan.dto';
import { UpdatePlanDto } from './dto/update-plan.dto';
import { PlansService, PlanWithArea } from './plans.service';

@Controller('plans')
export class PlansController {
  public constructor(private readonly plansService: PlansService) {}

  @UseGuards(OptionalJwtAuthGuard)
  @Post()
  public create(
    @Body() dto: CreatePlanDto,
    @CurrentUser() user?: CurrentUserPayload,
  ): Promise<PlanWithArea> {
    return this.plansService.create(dto, user?.userId);
  }

  @UseGuards(JwtAuthGuard)
  @Get('mine')
  public findMine(
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<PlanWithArea[]> {
    return this.plansService.findAllForUser(user.userId);
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

  @Patch(':id/finalize')
  public finalize(@Param('id') id: string): Promise<PlanWithArea> {
    return this.plansService.finalize(id);
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id/ai-description')
  public getAiDescription(
    @Param('id') id: string,
  ): Promise<{ description: string }> {
    return this.plansService.getAiDescription(id);
  }
}
