import { Controller, Get, Query } from '@nestjs/common';
import { GeocodeReverseQueryDto } from './dto/geocode-reverse-query.dto';
import { GeocodeSearchQueryDto } from './dto/geocode-search-query.dto';
import { GeocodingService } from './geocoding.service';
import { GeocodeReverseResult, GeocodeSearchResult } from './geocoding.types';

@Controller('geocode')
export class GeocodingController {
  public constructor(private readonly geocodingService: GeocodingService) {}

  @Get('search')
  public search(
    @Query() query: GeocodeSearchQueryDto,
  ): Promise<GeocodeSearchResult | null> {
    return this.geocodingService.search(query.q);
  }

  @Get('reverse')
  public reverse(
    @Query() query: GeocodeReverseQueryDto,
  ): Promise<GeocodeReverseResult> {
    return this.geocodingService.reverse(query.lat, query.lng);
  }
}
