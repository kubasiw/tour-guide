import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
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
  // endpoint in this app (area description, narration, chat).
  @UseGuards(JwtAuthGuard)
  @Get(':id/description')
  public getDescription(
    @Param('id') id: string,
  ): Promise<{ description: string }> {
    return this.poiService.getOrGenerateDescription(id);
  }
}
