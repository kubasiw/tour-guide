import { IsString, MinLength } from 'class-validator';

export class ChangePasswordDto {
  @IsString()
  public currentPassword!: string;

  @MinLength(8)
  public newPassword!: string;
}
