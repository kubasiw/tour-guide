import { IsString, MinLength } from 'class-validator';

export class ResetPasswordDto {
  @IsString()
  public token!: string;

  @MinLength(8)
  public newPassword!: string;
}
