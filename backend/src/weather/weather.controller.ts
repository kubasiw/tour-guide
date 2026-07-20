import { Controller, Get, Query } from '@nestjs/common';
import { GetForecastQueryDto } from './dto/get-forecast-query.dto';
import { Forecast } from './weather.types';
import { WeatherService } from './weather.service';

@Controller('weather')
export class WeatherController {
  public constructor(private readonly weatherService: WeatherService) {}

  @Get()
  public getForecast(@Query() query: GetForecastQueryDto): Promise<Forecast> {
    return this.weatherService.getForecast(
      query.lat,
      query.lng,
      query.startDate,
      query.durationDays,
    );
  }
}
