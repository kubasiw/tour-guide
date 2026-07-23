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
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AddPlanItemDto } from './dto/add-plan-item.dto';
import { AddTrailItemDto } from './dto/add-trail-item.dto';
import { ReorderItemsDto } from './dto/reorder-items.dto';
import { PlanGeneratorService } from './plan-generator.service';
import { PlanItemWithPoi, PlanTrailItem } from './plan-generator.types';
import { Poi } from '../poi/poi.types';
import { Trail } from '../trails/trails.types';

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

  @Get('trail-candidates')
  public findTrailCandidates(
    @Param('planId') planId: string,
  ): Promise<Trail[]> {
    return this.planGeneratorService.findTrailCandidates(planId);
  }

  @Get('trail-items')
  public findTrailItems(
    @Param('planId') planId: string,
  ): Promise<PlanTrailItem[]> {
    return this.planGeneratorService.findTrailItems(planId);
  }

  @Post('trail-items')
  public addTrailItem(
    @Param('planId') planId: string,
    @Body() dto: AddTrailItemDto,
  ): Promise<PlanTrailItem> {
    return this.planGeneratorService.addTrailItem(planId, dto.trailId);
  }

  @Delete('trail-items/:itemId')
  @HttpCode(HttpStatus.NO_CONTENT)
  public removeTrailItem(
    @Param('planId') planId: string,
    @Param('itemId') itemId: string,
  ): Promise<void> {
    return this.planGeneratorService.removeTrailItem(planId, itemId);
  }

  @UseGuards(JwtAuthGuard)
  @Post('narration')
  public generateNarration(
    @Param('planId') planId: string,
  ): Promise<{ narration: string }> {
    return this.planGeneratorService.generateNarration(planId);
  }
}
