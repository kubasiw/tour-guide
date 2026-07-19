import { Type } from 'class-transformer';
import {
  IsIn,
  IsArray,
  IsNumber,
  ValidateIf,
  ValidateNested,
} from 'class-validator';

export class LatLngDto {
  @IsNumber()
  public lat!: number;

  @IsNumber()
  public lng!: number;
}

export class AreaDto {
  @IsIn(['polygon', 'radius'])
  public kind!: 'polygon' | 'radius';

  @ValidateIf((dto: AreaDto) => dto.kind === 'polygon')
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => LatLngDto)
  public points?: LatLngDto[];

  @ValidateIf((dto: AreaDto) => dto.kind === 'radius')
  @ValidateNested()
  @Type(() => LatLngDto)
  public center?: LatLngDto;

  @ValidateIf((dto: AreaDto) => dto.kind === 'radius')
  @IsNumber()
  public radiusMeters?: number;
}
