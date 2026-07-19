import { Type } from 'class-transformer';
import { ValidateNested } from 'class-validator';
import { AreaDto } from './area.dto';

export class CreatePlanDto {
  @ValidateNested()
  @Type(() => AreaDto)
  public area!: AreaDto;
}
