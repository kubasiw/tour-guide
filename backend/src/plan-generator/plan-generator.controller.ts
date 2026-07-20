import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { AddPlanItemDto } from './dto/add-plan-item.dto';
import { ReorderItemsDto } from './dto/reorder-items.dto';
import { PlanGeneratorService } from './plan-generator.service';
import { PlanItemWithPoi } from './plan-generator.types';
import { Poi } from '../poi/poi.types';

@Controller('plans/:planId')
export class PlanGeneratorController {
  public constructor(
    private readonly planGeneratorService: PlanGeneratorService,
  ) {}

  @Get('candidates')
  public findCandidates(@Param('planId') planId: string): Promise<Poi[]> {
    return this.planGeneratorService.findCandidates(planId);
  }

  @Get('items')
  public findItems(
    @Param('planId') planId: string,
  ): Promise<PlanItemWithPoi[]> {
    return this.planGeneratorService.findItems(planId);
  }

  @Post('items')
  public addItem(
    @Param('planId') planId: string,
    @Body() dto: AddPlanItemDto,
  ): Promise<PlanItemWithPoi> {
    return this.planGeneratorService.addItem(planId, dto.poiId);
  }

  @Delete('items/:itemId')
  @HttpCode(HttpStatus.NO_CONTENT)
  public removeItem(
    @Param('planId') planId: string,
    @Param('itemId') itemId: string,
  ): Promise<void> {
    return this.planGeneratorService.removeItem(planId, itemId);
  }

  @Patch('items/reorder')
  public reorderItems(
    @Param('planId') planId: string,
    @Body() dto: ReorderItemsDto,
  ): Promise<PlanItemWithPoi[]> {
    return this.planGeneratorService.reorderItems(planId, dto.itemIds);
  }
}
