import { IsNotEmpty, IsString } from 'class-validator';

export class GeocodeSearchQueryDto {
  @IsString()
  @IsNotEmpty()
  public q!: string;
}
