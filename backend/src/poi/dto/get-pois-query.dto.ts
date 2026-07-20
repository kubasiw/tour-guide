import { Type } from 'class-transformer';
import { IsNumber } from 'class-validator';

export class GetPoisQueryDto {
  @Type(() => Number)
  @IsNumber()
  public south!: number;

  @Type(() => Number)
  @IsNumber()
  public west!: number;

  @Type(() => Number)
  @IsNumber()
  public north!: number;

  @Type(() => Number)
  @IsNumber()
  public east!: number;
}
