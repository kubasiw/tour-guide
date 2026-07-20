import { Controller, Get, Query } from '@nestjs/common';
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
}
