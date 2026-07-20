import { IsUUID } from 'class-validator';

export class AddPlanItemDto {
  @IsUUID()
  public poiId!: string;
}
