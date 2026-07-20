import { Type } from 'class-transformer';
import { IsNumber } from 'class-validator';

export class GeocodeReverseQueryDto {
  @Type(() => Number)
  @IsNumber()
  public lat!: number;

  @Type(() => Number)
  @IsNumber()
  public lng!: number;
}
