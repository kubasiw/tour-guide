import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { GetPoisQueryDto } from './dto/get-pois-query.dto';
import { PoiService } from './poi.service';
import { Poi } from './poi.types';

@Controller('pois')
export class PoiController {
  public constructor(private readonly poiService: PoiService) {}

  @Get()
  public findInBoundingBox(@Query() query: GetPoisQueryDto): Promise<Poi[]> {
    return this.poiService.findInBoundingBox(query);
  }

  // Hard login gate, same AI-cost-gating precedent as every other AI
  // endpoint in this app (area description, narration, chat). Also throttled tighter than the
  // default — this calls Claude, not free; a real per-day budget cap also lives in AiService.
  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Get(':id/description')
  public getDescription(
    @Param('id') id: string,
  ): Promise<{ description: string }> {
    return this.poiService.getOrGenerateDescription(id);
  }
}
