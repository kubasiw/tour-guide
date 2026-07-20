import { Type } from 'class-transformer';
import {
  IsArray,
  IsDate,
  IsIn,
  IsInt,
  IsOptional,
  Max,
  Min,
} from 'class-validator';
import { ACTIVITY_KEYS } from '../activity-keys';

export class UpdatePlanDto {
  @IsOptional()
  @IsArray()
  @IsIn(ACTIVITY_KEYS, { each: true })
  public activities?: string[];

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  public startDate?: Date;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(60)
  public durationDays?: number;
}
