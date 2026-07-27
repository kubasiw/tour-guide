import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { CurrentUser, type CurrentUserPayload } from './current-user.decorator';
import { ChangePasswordDto } from './dto/change-password.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

@Controller('auth')
export class AuthController {
  public constructor(private readonly authService: AuthService) {}

  // Ciaśniejszy limit niż domyślne 20/min — rejestracja to rzadka akcja dla realnego
  // użytkownika; bez tego skrypt mógłby zakładać nieograniczoną liczbę kont w pętli.
  @Throttle({ default: { limit: 3, ttl: 600000 } })
  @Post('register')
  public register(@Body() dto: RegisterDto): Promise<{ accessToken: string }> {
    return this.authService.register(dto.email, dto.password);
  }

  // Chroni przed brute-force haseł, nie tylko przed spamem.
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('login')
  public login(@Body() dto: LoginDto): Promise<{ accessToken: string }> {
    return this.authService.login(dto.email, dto.password);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  public me(@CurrentUser() user: CurrentUserPayload): CurrentUserPayload {
    return user;
  }

  // Rzadka akcja + istniejąca ochrona przed enumeracją kont — dodatkowo ograniczona, żeby nie dało
  // się jej użyć jako taniego sposobu na wysyłanie masowych maili/próbowanie wielu adresów.
  @Throttle({ default: { limit: 3, ttl: 3600000 } })
  @Post('forgot-password')
  public forgotPassword(
    @Body() dto: ForgotPasswordDto,
  ): Promise<{ message: string }> {
    return this.authService.forgotPassword(dto.email);
  }

  @Post('reset-password')
  public resetPassword(
    @Body() dto: ResetPasswordDto,
  ): Promise<{ message: string }> {
    return this.authService.resetPassword(dto.token, dto.newPassword);
  }

  @UseGuards(JwtAuthGuard)
  @Post('change-password')
  public changePassword(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: ChangePasswordDto,
  ): Promise<{ message: string }> {
    return this.authService.changePassword(
      user.email,
      dto.currentPassword,
      dto.newPassword,
    );
  }
}
