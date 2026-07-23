import { IsUUID } from 'class-validator';

export class AddTrailItemDto {
  @IsUUID()
  public trailId!: string;
}
