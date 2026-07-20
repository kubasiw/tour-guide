import { Type } from 'class-transformer';
import {
  IsDateString,
  IsInt,
  IsNumber,
  IsOptional,
  Min,
} from 'class-validator';

export class GetForecastQueryDto {
  @Type(() => Number)
  @IsNumber()
  public lat!: number;

  @Type(() => Number)
  @IsNumber()
  public lng!: number;

  @IsOptional()
  @IsDateString()
  public startDate?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  public durationDays?: number;
}
