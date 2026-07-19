import { IsEmail, MinLength } from 'class-validator';

export class RegisterDto {
  @IsEmail()
  public email!: string;

  @MinLength(8)
  public password!: string;
}
