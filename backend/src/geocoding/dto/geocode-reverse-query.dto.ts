import { Type } from 'class-transformer';
import { IsInt, IsNumber, IsOptional, Max, Min } from 'class-validator';

export class GeocodeReverseQueryDto {
  @Type(() => Number)
  @IsNumber()
  public lat!: number;

  @Type(() => Number)
  @IsNumber()
  public lng!: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(18)
  public zoom?: number;
}
