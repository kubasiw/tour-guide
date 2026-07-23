import { Controller, Get, Param, Query } from '@nestjs/common';
import { GetTrailsQueryDto } from './dto/get-trails-query.dto';
import { TrailsService } from './trails.service';
import { Trail, TrailGeometry } from './trails.types';

@Controller('trails')
export class TrailsController {
  public constructor(private readonly trailsService: TrailsService) {}

  @Get()
  public findInBoundingBox(
    @Query() query: GetTrailsQueryDto,
  ): Promise<Trail[]> {
    return this.trailsService.findInBoundingBox(query);
  }

  @Get(':osmId/geometry')
  public getGeometry(@Param('osmId') osmId: string): Promise<TrailGeometry> {
    return this.trailsService.getGeometry(osmId);
  }
}
